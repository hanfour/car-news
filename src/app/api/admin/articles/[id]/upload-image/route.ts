import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import sharp from 'sharp'
import crypto from 'crypto'
import { uploadToR2 } from '@/lib/storage/r2-client'
import { logger } from '@/lib/logger'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

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

    logger.info('api.admin.upload_image_start', {
      articleId: id,
      fileSizeKb: Number((buffer.length / 1024).toFixed(1)),
      imageCredit,
    })

    // 2. 浮水印功能已停用
    logger.info('api.admin.upload_image_watermark_disabled', { articleId: id })

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

    logger.info('api.admin.upload_image_processed', {
      articleId: id,
      processedSizeKb: Number((buffer.length / 1024).toFixed(1)),
    })

    // 4. 生成文件名
    const hash = crypto.createHash('md5').update(buffer).digest('hex')
    const fileName = `custom-${id}-${Date.now()}-${hash.slice(0, 8)}.webp`

    // 5. 上傳到 R2
    const publicUrl = await uploadToR2(fileName, buffer, 'image/webp')

    // 6. 更新文章的封面圖片
    const supabase = createServiceClient()
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({
        cover_image: publicUrl,
        image_credit: imageCredit
      })
      .eq('id', id)

    if (updateError) {
      logger.error('api.admin.upload_image_update_fail', updateError, { articleId: id })
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    logger.info('api.admin.upload_image_done', { articleId: id, publicUrl })

    return NextResponse.json({
      success: true,
      cover_image: publicUrl,
      image_credit: imageCredit
    })

  } catch (error) {
    logger.error('api.admin.upload_image_fail', error, { articleId: id })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
