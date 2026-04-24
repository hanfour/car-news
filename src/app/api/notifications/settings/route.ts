import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET: 取得通知偏好
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logger.error('api.notifications.settings_get_fail', error, { userId })
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 如果沒有設定，回傳預設值
    return NextResponse.json({
      settings: data || {
        comment_reply: true,
        comment_like: true,
        new_follower: true,
        followed_activity: true,
        forum_reply: true,
        car_club_post: true,
      },
    })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// PATCH: 更新通知偏好
export async function PATCH(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const body = await request.json()
    const allowedFields = ['comment_reply', 'comment_like', 'new_follower', 'followed_activity', 'forum_reply', 'car_club_post']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (field in body && typeof body[field] === 'boolean') {
        updates[field] = body[field]
      }
    }

    // Upsert
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      logger.error('api.notifications.settings_update_fail', error, { userId })
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
