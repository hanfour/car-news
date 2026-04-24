import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// GET: 粉絲列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = createClient()

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    // 找到用戶
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

    // 查詢粉絲
    const { data: follows, count, error } = await supabase
      .from('user_follows')
      .select('follower_id, created_at', { count: 'exact' })
      .eq('following_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 查詢 profiles
    if (follows && follows.length > 0) {
      const ids = follows.map(f => f.follower_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .in('id', ids)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      return NextResponse.json({
        users: follows.map(f => ({
          ...profilesMap.get(f.follower_id),
          followed_at: f.created_at,
        })),
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ users: [], total: 0, page: 1, totalPages: 0 })
  } catch (error) {
    logger.error('api.user.followers_list_fail', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
