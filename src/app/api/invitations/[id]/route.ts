import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH: 接受或拒絕邀請
export async function PATCH(
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
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }
    const { action } = await request.json()

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 })
    }

    // 先取出邀請，明確檢查 expires_at（migration 有 expires_at 但原本 update 沒驗證，過期邀請也能 accept）
    const { data: existing } = await supabase
      .from('club_invitations')
      .select('id, status, expires_at')
      .eq('id', id)
      .eq('invitee_id', userId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: '找不到邀請' }, { status: 404 })
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: '此邀請已處理' }, { status: 410 })
    }
    if (existing.expires_at && new Date(existing.expires_at) <= new Date()) {
      // 順手把過期 invitation 標 expired，避免下次再來
      await supabase
        .from('club_invitations')
        .update({ status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ error: '邀請已過期' }, { status: 410 })
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined'

    // RLS 會確保只有 invitee 可以更新 pending 邀請
    const { data: invitation, error } = await supabase
      .from('club_invitations')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .select()
      .single()

    if (error || !invitation) {
      return NextResponse.json({ error: '操作失敗' }, { status: 500 })
    }

    // 如果接受，加入車友會（member_count 由 DB trigger 自動更新）
    if (action === 'accept') {
      const serviceClient = auth.getServiceClient()

      const { error: joinError } = await serviceClient
        .from('car_club_members')
        .insert({
          club_id: invitation.club_id,
          user_id: userId,
          role: 'member',
          status: 'active',
        })

      if (joinError && joinError.code !== '23505') {
        logger.error('api.invitations.accept_join_fail', joinError, { invitationId: id, userId })
        return NextResponse.json({ error: '加入車友會失敗' }, { status: 500 })
      }
    }

    return NextResponse.json({ invitation })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
