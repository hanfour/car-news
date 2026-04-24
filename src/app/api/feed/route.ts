import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET: 動態牆 (fan-out-on-read)
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth
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

    type FeedItem = {
      type: string
      id: string
      created_at: string
      data: Record<string, unknown>
    }

    // 從每個 source 取 offset + limit 筆，確保合併後分頁正確
    const fetchLimit = offset + limit

    // 平行取得追蹤用戶的評論和追蹤品牌的文章
    const [commentsResult, articlesResult] = await Promise.all([
      // 追蹤用戶的評論
      (async (): Promise<FeedItem[]> => {
        if (!followedUsers || followedUsers.length === 0) return []
        const userIds = followedUsers.map(f => f.following_id)
        const { data: comments } = await supabase
          .from('comments')
          .select('id, content, created_at, user_id, article_id')
          .in('user_id', userIds)
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(fetchLimit)

        if (!comments || comments.length === 0) return []

        // 平行查詢 profiles 和文章標題
        const cUserIds = [...new Set(comments.map(c => c.user_id))]
        const articleIds = [...new Set(comments.map(c => c.article_id))]

        const [{ data: profiles }, { data: articles }] = await Promise.all([
          supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', cUserIds),
          supabase.from('generated_articles').select('id, title_zh, slug_en, published_at').in('id', articleIds),
        ])

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])
        const articlesMap = new Map(articles?.map(a => [a.id, a]) || [])

        return comments.map(comment => ({
          type: 'comment',
          id: comment.id,
          created_at: comment.created_at,
          data: {
            ...comment,
            profile: profilesMap.get(comment.user_id) || null,
            article: articlesMap.get(comment.article_id) || null,
          },
        }))
      })(),

      // 追蹤品牌的新文章
      (async (): Promise<FeedItem[]> => {
        if (!followedBrands || followedBrands.length === 0) return []
        const brands = followedBrands.map(b => b.topic_value)
        const { data: articles } = await supabase
          .from('generated_articles')
          .select('id, title_zh, slug_en, published_at, cover_image, primary_brand, categories')
          .eq('published', true)
          .in('primary_brand', brands)
          .order('published_at', { ascending: false })
          .limit(fetchLimit)

        if (!articles) return []
        return articles.map(article => ({
          type: 'article',
          id: article.id,
          created_at: article.published_at,
          data: article,
        }))
      })(),
    ])

    // 合併、排序、分頁
    const allItems = [...commentsResult, ...articlesResult]
    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const paged = allItems.slice(offset, offset + limit)
    const hasMore = allItems.length > offset + limit

    return NextResponse.json({
      items: paged,
      total: allItems.length,
      page,
      hasMore,
      totalPages: Math.ceil(allItems.length / limit),
    })
  } catch (error) {
    logger.error('api.feed.list_fail', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
