import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateSocialSummary } from '@/lib/social/content-generator'
import { verifyAdminAuth } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/social-posts
 * 獲取社群貼文列表，支援 status 和 platform 篩選
 */
export async function GET(request: NextRequest) {
  try {
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')

    const supabase = createServiceClient()

    let query = supabase
      .from('social_posts')
      .select(`
        *,
        article:generated_articles(
          id,
          title_zh,
          slug_en,
          brand_tags,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) {
      query = query.eq('status', status)
    }

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('[Social Posts] Failed to fetch posts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('[Social Posts] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/social-posts
 * 為文章創建社群貼文（生成摘要並加入待審核隊列）
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { articleId, platforms } = body as {
      articleId: string
      platforms: ('facebook' | 'instagram' | 'threads')[]
    }

    if (!articleId || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: article, error: articleError } = await supabase
      .from('generated_articles')
      .select('id, title_zh, content_zh, slug_en')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
    const articleUrl = `${baseUrl}/${article.slug_en}`

    const createdPosts = []

    for (const platform of platforms) {
      const summary = await generateSocialSummary(
        article.title_zh,
        article.content_zh,
        articleUrl,
        platform
      )

      const { data: post, error: postError } = await supabase
        .from('social_posts')
        .insert({
          article_id: article.id,
          platform,
          content: summary,
          article_url: articleUrl,
          status: 'pending'
        })
        .select()
        .single()

      if (postError) {
        console.error(`[Social Posts] Failed to create ${platform} post:`, postError)
        continue
      }

      createdPosts.push(post)
    }

    return NextResponse.json({
      success: true,
      posts: createdPosts
    })
  } catch (error) {
    console.error('[Social Posts] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
