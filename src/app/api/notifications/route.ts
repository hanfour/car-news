import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 通知列表（分頁）
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

    const { data: notifications, count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[Notifications GET] Error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 批量查詢 actor profiles
    if (notifications && notifications.length > 0) {
      const actorIds = [...new Set(notifications.filter(n => n.actor_id).map(n => n.actor_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', actorIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      const notificationsWithActors = notifications.map(n => ({
        ...n,
        actor: n.actor_id ? profilesMap.get(n.actor_id) || null : null,
      }))

      return NextResponse.json({
        notifications: notificationsWithActors,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ notifications: [], total: 0, page: 1, totalPages: 0 })
  } catch (error) {
    console.error('[Notifications GET] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
