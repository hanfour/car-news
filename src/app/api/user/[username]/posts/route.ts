import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 15
    const offset = (page - 1) * limit

    // Find user
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    const userId = profile?.id
    if (!userId) {
      // Try by ID
      const { data: posts, count } = await supabase
        .from('forum_posts')
        .select('id, title, content, reply_count, like_count, created_at, category_id', { count: 'exact' })
        .eq('user_id', username)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      return NextResponse.json({
        posts: posts || [],
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    const { data: posts, count } = await supabase
      .from('forum_posts')
      .select('id, title, content, reply_count, like_count, created_at, category_id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Get categories
    if (posts && posts.length > 0) {
      const catIds = [...new Set(posts.map(p => p.category_id))]
      const { data: cats } = await supabase
        .from('forum_categories')
        .select('id, name, slug, icon')
        .in('id', catIds)

      const catsMap = new Map(cats?.map(c => [c.id, c]) || [])

      const postsWithCats = posts.map(p => ({
        ...p,
        category: catsMap.get(p.category_id) || null,
      }))

      return NextResponse.json({
        posts: postsWithCats,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ posts: [], total: 0, page: 1, totalPages: 0 })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
