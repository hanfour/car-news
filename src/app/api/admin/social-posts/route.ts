import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateSocialSummary } from '@/lib/social/content-generator'
import { verifyAdminAuth } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/social-posts
 * 獲取待審核的社群貼文列表
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // 獲取所有待審核的貼文，按建立時間排序
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select(`
        *,
        article:generated_articles(
          id,
          title,
          slug,
          brand_tags,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

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
    // Verify admin authentication
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

    // 獲取文章資訊
    const { data: article, error: articleError } = await supabase
      .from('generated_articles')
      .select('id, title, content, slug')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    const articleUrl = `https://wantcar.autos/${article.slug}`

    // 為每個平台生成貼文
    const createdPosts = []

    for (const platform of platforms) {
      // 生成社群媒體摘要
      const summary = await generateSocialSummary(
        article.title,
        article.content,
        articleUrl,
        platform
      )

      // 創建待審核貼文
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
