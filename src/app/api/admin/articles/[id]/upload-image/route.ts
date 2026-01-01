import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { addWatermark } from '@/lib/utils/watermark'
import sharp from 'sharp'
import crypto from 'crypto'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY
const BUCKET_NAME = 'article-images'

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${ADMIN_API_KEY}`) {
    return true
  }

  const sessionCookie = request.cookies.get('admin_session')
  if (sessionCookie?.value) {
    const userId = await verifySessionToken(sessionCookie.value)
    if (!userId) {
      return false
    }

    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    return data?.is_admin === true
  }

  return false
}

// POST /api/admin/articles/[id]/upload-image - 上傳自訂圖片
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const imageCredit = formData.get('imageCredit') as string || '圖片來源：網路'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 1. 讀取檔案
    const arrayBuffer = await file.arrayBuffer()
    let buffer: Buffer = Buffer.from(new Uint8Array(arrayBuffer))

    console.log(`→ Processing uploaded image for article ${id}`)
    console.log(`   File size: ${(buffer.length / 1024).toFixed(1)} KB`)
    console.log(`   Image credit: ${imageCredit}`)

    // 2. 添加浮水印（使用自訂來源文字）
    // ⚠️ 注意：Vercel 無中文字體，中文會變亂碼，建議使用英文
    buffer = await addWatermark(buffer, {
      text: imageCredit,
      subText: null,
      position: 'bottom-right',
      opacity: 0.7,
      fontSize: 32
    })

    // 3. 優化並轉換為 WebP
    buffer = await sharp(buffer)
      .resize(1792, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({
        quality: 85,
        effort: 6
      })
      .toBuffer()

    console.log(`✓ Image processed, size: ${(buffer.length / 1024).toFixed(1)} KB`)

    // 4. 生成文件名
    const hash = crypto.createHash('md5').update(buffer).digest('hex')
    const fileName = `custom-${id}-${Date.now()}-${hash.slice(0, 8)}.webp`

    // 5. 上傳到 Supabase Storage
    const supabase = createServiceClient()

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      console.error('✗ Upload failed:', uploadError.message)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 6. 獲取公開 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    const publicUrl = publicUrlData.publicUrl

    // 7. 更新文章的封面圖片
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({
        cover_image: publicUrl,
        image_credit: imageCredit
      })
      .eq('id', id)

    if (updateError) {
      console.error('✗ Update article failed:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`✓ Image uploaded and article updated: ${publicUrl}`)

    return NextResponse.json({
      success: true,
      cover_image: publicUrl,
      image_credit: imageCredit
    })

  } catch (error) {
    console.error('Upload image error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
