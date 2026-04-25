import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 取得 viewer 與其他人之間的雙向 block 關係（viewer 封鎖的人 + 封鎖 viewer 的人）。
 */
async function getBlockedIdsFor(
  supabase: SupabaseClient,
  viewerId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)

  const set = new Set<string>()
  for (const b of data || []) {
    if (b.blocker_id === viewerId) set.add(b.blocked_id)
    if (b.blocked_id === viewerId) set.add(b.blocker_id)
  }
  return set
}

// GET: 追蹤列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = createClient()

    const auth = await createAuthenticatedClient(request).catch(() => null)
    const viewerId = auth?.userId

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

    // 查詢追蹤對象
    const { data: follows, count, error } = await supabase
      .from('user_follows')
      .select('following_id, created_at', { count: 'exact' })
      .eq('follower_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    if (follows && follows.length > 0) {
      const blockedIds = viewerId ? await getBlockedIdsFor(supabase, viewerId) : new Set<string>()
      const visibleFollows = follows.filter(f => !blockedIds.has(f.following_id))

      const ids = visibleFollows.map(f => f.following_id)
      const { data: profiles } = ids.length > 0
        ? await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, bio')
            .in('id', ids)
        : { data: [] as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null }> }

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      return NextResponse.json({
        users: visibleFollows.map(f => ({
          ...profilesMap.get(f.following_id),
          followed_at: f.created_at,
        })),
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ users: [], total: 0, page: 1, totalPages: 0 })
  } catch (error) {
    logger.error('api.user.following_list_fail', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
