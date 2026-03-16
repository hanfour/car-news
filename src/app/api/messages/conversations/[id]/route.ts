import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 對話詳情（參與者資訊）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth
    const { id } = await params

    // RLS 確保只有參與者可查看
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !conversation) {
      return NextResponse.json({ error: '找不到此對話' }, { status: 404 })
    }

    // 取得參與者
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id, last_read_at, is_muted')
      .eq('conversation_id', id)

    const serviceClient = auth.getServiceClient()
    const userIds = participants?.map(p => p.user_id) || []
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds)

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const enrichedParticipants = participants?.map(p => ({
      ...p,
      profile: profilesMap.get(p.user_id) || null,
      is_self: p.user_id === userId,
    })) || []

    return NextResponse.json({
      conversation,
      participants: enrichedParticipants,
    })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
