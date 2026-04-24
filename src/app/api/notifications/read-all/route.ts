import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// PATCH: 全部已讀
export async function PATCH(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (error) {
      logger.error('api.notifications.read_all_fail', error, { userId })
      return NextResponse.json({ error: '操作失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
