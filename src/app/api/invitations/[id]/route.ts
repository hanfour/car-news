import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

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
    const { action } = await request.json()

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 })
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
        console.error('[Invitations PATCH] Join error:', joinError)
        return NextResponse.json({ error: '加入車友會失敗' }, { status: 500 })
      }
    }

    return NextResponse.json({ invitation })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
