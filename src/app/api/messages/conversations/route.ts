import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// GET: 對話列表
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // 取得使用者參與的所有對話
    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, is_muted')
      .eq('user_id', userId)

    if (!participations || participations.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const conversationIds = participations.map(p => p.conversation_id)

    // 取得對話資訊
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    // 取得所有參與者
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, last_read_at')
      .in('conversation_id', conversationIds)

    // 取得 profiles
    const allUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])]
    const serviceClient = auth.getServiceClient()
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', allUserIds)

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])
    const participationsMap = new Map(participations.map(p => [p.conversation_id, p]))

    const enriched = conversations.map(conv => {
      const myParticipation = participationsMap.get(conv.id)
      const otherParticipants = allParticipants
        ?.filter(p => p.conversation_id === conv.id && p.user_id !== userId)
        .map(p => profilesMap.get(p.user_id))
        .filter(Boolean) || []

      const hasUnread = conv.last_message_at && myParticipation?.last_read_at
        ? new Date(conv.last_message_at) > new Date(myParticipation.last_read_at)
        : !!conv.last_message_at

      return {
        ...conv,
        other_participants: otherParticipants,
        is_muted: myParticipation?.is_muted || false,
        has_unread: hasUnread,
      }
    })

    return NextResponse.json({ conversations: enriched })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 建立或取得對話
export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { userId } = auth

    const rl = rateLimit(`dm-create:${userId}`, { maxRequests: 30, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁' }, { status: 429 })
    }

    const { username } = await request.json()
    if (!username) {
      return NextResponse.json({ error: '請提供使用者名稱' }, { status: 400 })
    }

    // 查找目標使用者
    const serviceClient = auth.getServiceClient()
    const { data: target } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (!target) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    if (target.id === userId) {
      return NextResponse.json({ error: '不能與自己對話' }, { status: 400 })
    }

    // 使用 RPC 找到或建立對話
    const { data: conversationId, error } = await serviceClient
      .rpc('find_or_create_conversation', { p_user1: userId, p_user2: target.id })

    if (error) {
      console.error('[Conversations POST] RPC error:', error)
      return NextResponse.json({ error: '建立對話失敗' }, { status: 500 })
    }

    return NextResponse.json({ conversation_id: conversationId })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
