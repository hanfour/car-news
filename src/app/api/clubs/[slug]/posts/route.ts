import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { moderateComment } from '@/lib/ai/claude'
import { rateLimit } from '@/lib/rate-limit'

// GET: 車友會貼文
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    // 有 auth 時用 RLS client（可看到私人 club 的貼文），否則用 anon（只看公開 club）
    const auth = await createAuthenticatedClient(request)
    const supabase = auth?.supabase || createClient()

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    const { data: club } = await supabase.from('car_clubs').select('id').eq('slug', slug).single()
    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    const { data: posts, count, error } = await supabase
      .from('car_club_posts')
      .select('*', { count: 'exact' })
      .eq('club_id', club.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 作者 profiles
    if (posts && posts.length > 0) {
      const userIds = [...new Set(posts.map(p => p.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      return NextResponse.json({
        posts: posts.map(p => ({ ...p, author: profilesMap.get(p.user_id) || null })),
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

// POST: 新增貼文
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`club-post:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { data: club } = await supabase.from('car_clubs').select('id').eq('slug', slug).single()
    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    // 檢查是否為成員
    const { data: member } = await supabase
      .from('car_club_members')
      .select('user_id')
      .eq('club_id', club.id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: '請先加入車友會' }, { status: 403 })
    }

    const { content, images } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: '請輸入內容' }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: '內容過長（最多5000字）' }, { status: 400 })
    }

    // AI 內容審核
    const moderation = await moderateComment(content)
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json({ error: '內容包含不當內容，無法發布' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('car_club_posts')
      .insert({
        club_id: club.id,
        user_id: userId,
        content,
        images: images || [],
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '發布失敗' }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
