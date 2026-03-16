import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 未讀訊息數量
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // 單一查詢：JOIN conversations 在 DB 端計算未讀數
    const { data, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, conversations!inner(last_message_at)')
      .eq('user_id', userId)
      .not('conversations.last_message_at', 'is', null)

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    const unreadCount = (data || []).filter(row => {
      const conv = row.conversations as unknown as { last_message_at: string }
      return !row.last_read_at || new Date(conv.last_message_at) > new Date(row.last_read_at)
    }).length

    return NextResponse.json({ unread_count: unreadCount })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
