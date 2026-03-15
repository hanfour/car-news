import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 使用者的收藏列表（隱私控制）
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

    // 找到 user
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)
    let profileQuery = supabase.from('profiles').select('id, is_favorites_public')
    if (isUuid) {
      profileQuery = profileQuery.eq('id', username)
    } else {
      profileQuery = profileQuery.eq('username', username)
    }
    const { data: profile } = await profileQuery.single()

    if (!profile) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    // 檢查隱私：是否公開或是自己
    const auth = await createAuthenticatedClient(request)
    const isSelf = auth?.userId === profile.id

    if (!profile.is_favorites_public && !isSelf) {
      return NextResponse.json({ error: '此使用者的收藏為私人' }, { status: 403 })
    }

    // 查詢收藏
    const { data: favorites, count, error } = await supabase
      .from('user_favorites')
      .select('article_id, created_at', { count: 'exact' })
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[User Favorites GET] Error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 批量查詢文章資訊
    if (favorites && favorites.length > 0) {
      const articleIds = favorites.map(f => f.article_id)
      const { data: articles } = await supabase
        .from('generated_articles')
        .select('id, title_zh, slug_en, published_at, cover_image, categories, primary_brand')
        .in('id', articleIds)
        .eq('published', true)

      const articlesMap = new Map(articles?.map(a => [a.id, a]) || [])

      const favoritesWithArticles = favorites
        .map(fav => ({
          ...fav,
          article: articlesMap.get(fav.article_id) || null,
        }))
        .filter(fav => fav.article !== null)

      return NextResponse.json({
        favorites: favoritesWithArticles,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ favorites: [], total: 0, page: 1, totalPages: 0 })
  } catch (error) {
    console.error('[User Favorites GET] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
