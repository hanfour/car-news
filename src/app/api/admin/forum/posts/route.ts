import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase'

// GET: 論壇貼文管理列表（搜尋、篩選、分頁）
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdminAuth(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const offset = (page - 1) * limit
  const search = searchParams.get('search')
  const filter = searchParams.get('filter') // all | pending | pinned | locked
  const categoryId = searchParams.get('category_id')

  let query = supabase
    .from('forum_posts')
    .select('*', { count: 'exact' })

  // 篩選
  if (filter === 'pending') {
    query = query.eq('is_approved', false)
  } else if (filter === 'pinned') {
    query = query.eq('is_pinned', true)
  } else if (filter === 'locked') {
    query = query.eq('is_locked', true)
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  // 搜尋
  if (search) {
    const sanitized = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`title.ilike.%${sanitized}%,content.ilike.%${sanitized}%`)
  }

  query = query.order('created_at', { ascending: false })

  const { data: posts, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('[Admin Forum GET] Error:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  // Fetch author profiles + categories
  if (posts && posts.length > 0) {
    const userIds = [...new Set(posts.map(p => p.user_id))]
    const categoryIds = [...new Set(posts.map(p => p.category_id))]

    const [profilesRes, categoriesRes] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds),
      supabase.from('forum_categories').select('id, name, slug, icon').in('id', categoryIds),
    ])

    const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || [])
    const categoriesMap = new Map(categoriesRes.data?.map(c => [c.id, c]) || [])

    const postsWithDetails = posts.map(post => ({
      ...post,
      author: profilesMap.get(post.user_id) || null,
      category: categoriesMap.get(post.category_id) || null,
    }))

    return NextResponse.json({
      posts: postsWithDetails,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  }

  return NextResponse.json({ posts: [], total: 0, page: 1, totalPages: 0 })
}
