import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET: 動態牆 (fan-out-on-read)
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { userId } = auth

    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    // 取得追蹤的用戶
    const { data: followedUsers } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)

    // 取得追蹤的品牌
    const { data: followedBrands } = await supabase
      .from('topic_follows')
      .select('topic_value')
      .eq('user_id', userId)
      .eq('topic_type', 'brand')

    const feedItems: Array<{
      type: string
      id: string
      created_at: string
      data: Record<string, unknown>
    }> = []

    // 追蹤用戶的評論
    if (followedUsers && followedUsers.length > 0) {
      const userIds = followedUsers.map(f => f.following_id)
      const { data: comments } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id, article_id')
        .in('user_id', userIds)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (comments) {
        // 查詢 profiles
        const cUserIds = [...new Set(comments.map(c => c.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', cUserIds)
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

        // 查詢文章標題
        const articleIds = [...new Set(comments.map(c => c.article_id))]
        const { data: articles } = await supabase
          .from('generated_articles')
          .select('id, title_zh, slug_en, published_at')
          .in('id', articleIds)
        const articlesMap = new Map(articles?.map(a => [a.id, a]) || [])

        for (const comment of comments) {
          feedItems.push({
            type: 'comment',
            id: comment.id,
            created_at: comment.created_at,
            data: {
              ...comment,
              profile: profilesMap.get(comment.user_id) || null,
              article: articlesMap.get(comment.article_id) || null,
            },
          })
        }
      }
    }

    // 追蹤品牌的新文章
    if (followedBrands && followedBrands.length > 0) {
      const brands = followedBrands.map(b => b.topic_value)
      const { data: articles } = await supabase
        .from('generated_articles')
        .select('id, title_zh, slug_en, published_at, cover_image, primary_brand, categories')
        .eq('published', true)
        .in('primary_brand', brands)
        .order('published_at', { ascending: false })
        .limit(limit)

      if (articles) {
        for (const article of articles) {
          feedItems.push({
            type: 'article',
            id: article.id,
            created_at: article.published_at,
            data: article,
          })
        }
      }
    }

    // 按時間排序
    feedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 分頁
    const paged = feedItems.slice(offset, offset + limit)
    const total = feedItems.length

    return NextResponse.json({
      items: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[Feed] Error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
