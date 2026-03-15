import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET: 使用者的評論紀錄
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = createServiceClient()

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    // 先找到 user
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)
    let profileQuery = supabase.from('profiles').select('id')
    if (isUuid) {
      profileQuery = profileQuery.eq('id', username)
    } else {
      profileQuery = profileQuery.eq('username', username)
    }
    const { data: profile } = await profileQuery.single()

    if (!profile) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    // 查詢評論
    const { data: comments, count, error } = await supabase
      .from('comments')
      .select('id, content, created_at, article_id, likes_count, parent_id', { count: 'exact' })
      .eq('user_id', profile.id)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[User Comments GET] Error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 批量查詢文章標題
    if (comments && comments.length > 0) {
      const articleIds = [...new Set(comments.map(c => c.article_id))]
      const { data: articles } = await supabase
        .from('generated_articles')
        .select('id, title_zh, slug_en, published_at')
        .in('id', articleIds)

      const articlesMap = new Map(articles?.map(a => [a.id, a]) || [])

      const commentsWithArticles = comments.map(comment => ({
        ...comment,
        article: articlesMap.get(comment.article_id) || null,
      }))

      return NextResponse.json({
        comments: commentsWithArticles,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ comments: [], total: 0, page: 1, totalPages: 0 })
  } catch (error) {
    console.error('[User Comments GET] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
