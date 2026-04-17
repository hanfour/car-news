import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { moderateComment } from '@/lib/ai/claude'
import { rateLimit } from '@/lib/rate-limit'

// GET: 貼文列表
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit
    const sort = searchParams.get('sort') || 'latest'
    const search = searchParams.get('search')

    let query = supabase
      .from('forum_posts')
      .select('*', { count: 'exact' })
      .eq('is_approved', true)

    if (category) {
      // 用 slug 找 category_id
      const { data: cat } = await supabase
        .from('forum_categories')
        .select('id')
        .eq('slug', category)
        .single()

      if (cat) {
        query = query.eq('category_id', cat.id)
      }
    }

    // 搜尋（sanitize 特殊字元防止 PostgREST filter injection）
    if (search) {
      const trimmed = search.trim().slice(0, 100)
      if (trimmed.length >= 2) {
        // 移除 PostgREST filter 語法中的危險字元，保留中日韓文字和字母數字
        const sanitized = trimmed
          .replace(/[%_\\]/g, '\\$&')
          .replace(/[.,()'"]/g, '')
        query = query.or(`title.ilike.%${sanitized}%,content.ilike.%${sanitized}%`)
      }
    }

    // 排序
    if (sort === 'popular') {
      query = query.order('reply_count', { ascending: false })
    } else if (sort === 'active') {
      query = query.order('last_reply_at', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
    }

    const { data: posts, count, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('[Forum Posts GET] Error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 查詢作者 profiles
    if (posts && posts.length > 0) {
      const userIds = [...new Set(posts.map(p => p.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      // 查詢分類資訊
      const categoryIds = [...new Set(posts.map(p => p.category_id))]
      const { data: categories } = await supabase
        .from('forum_categories')
        .select('id, name, slug, icon')
        .in('id', categoryIds)

      const categoriesMap = new Map(categories?.map(c => [c.id, c]) || [])

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
  } catch (error) {
    console.error('[Forum Posts GET] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 新增貼文
export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`forum-post:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { category_id, title, content, tags, related_brand, related_model } = await request.json()

    if (!category_id || !title || !content) {
      return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 })
    }

    if (title.length > 200) {
      return NextResponse.json({ error: '標題過長（最多200字）' }, { status: 400 })
    }

    if (content.length > 10000) {
      return NextResponse.json({ error: '內容過長（最多10000字）' }, { status: 400 })
    }

    // AI 審核（複用 moderateComment）
    const moderation = await moderateComment(title + '\n' + content)
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json({ error: '內容包含不當內容，無法發布' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        category_id,
        user_id: userId,
        title,
        content,
        tags: tags || [],
        related_brand: related_brand || null,
        related_model: related_model || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Forum Posts POST] Error:', error)
      return NextResponse.json({ error: '發布失敗' }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch (error) {
    console.error('[Forum Posts POST] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
