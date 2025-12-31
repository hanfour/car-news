import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { generateCoverImage } from '@/lib/ai/image-generation'
import { uploadImageFromUrl } from '@/lib/storage/image-uploader'

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

// POST /api/admin/articles/[id]/regenerate-image - 重新生成封面圖
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  // 1. 獲取文章資訊
  const { data: article, error: fetchError } = await supabase
    .from('generated_articles')
    .select('title_zh, content_zh, brands, primary_brand')
    .eq('id', id)
    .single()

  if (fetchError || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  try {
    // 2. 生成新圖片
    console.log(`→ Regenerating cover image for article ${id}...`)
    const imageResult = await generateCoverImage(
      article.title_zh,
      article.content_zh,
      article.brands || (article.primary_brand ? [article.primary_brand] : undefined)
    )

    if (!imageResult?.url) {
      return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
    }

    // 3. 上傳到永久存儲
    const brand = article.primary_brand || 'article'
    const fileName = `ai-${brand.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
    const permanentUrl = await uploadImageFromUrl(imageResult.url, fileName, true)

    if (!permanentUrl) {
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // 4. 更新資料庫
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({
        cover_image: permanentUrl,
        image_credit: 'AI 生成示意圖'
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`✓ Cover image regenerated for article ${id}`)

    return NextResponse.json({
      success: true,
      cover_image: permanentUrl
    })

  } catch (error) {
    console.error('Regenerate image error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
