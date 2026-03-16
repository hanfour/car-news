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

    // 取得使用者的所有參與記錄
    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)

    if (!participations || participations.length === 0) {
      return NextResponse.json({ unread_count: 0 })
    }

    const conversationIds = participations.map(p => p.conversation_id)

    // 取得對話的 last_message_at
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, last_message_at')
      .in('id', conversationIds)
      .not('last_message_at', 'is', null)

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ unread_count: 0 })
    }

    const participationsMap = new Map(participations.map(p => [p.conversation_id, p]))

    let unreadCount = 0
    for (const conv of conversations) {
      const participation = participationsMap.get(conv.id)
      if (participation && conv.last_message_at) {
        if (!participation.last_read_at || new Date(conv.last_message_at) > new Date(participation.last_read_at)) {
          unreadCount++
        }
      }
    }

    return NextResponse.json({ unread_count: unreadCount })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
