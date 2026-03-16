import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 我的待處理邀請
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { data: invitations, error } = await supabase
      .from('club_invitations')
      .select('*')
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // Fetch club info + inviter profiles
    if (invitations && invitations.length > 0) {
      const serviceClient = auth.getServiceClient()
      const clubIds = [...new Set(invitations.map(i => i.club_id))]
      const inviterIds = [...new Set(invitations.map(i => i.inviter_id))]

      const [clubsRes, profilesRes] = await Promise.all([
        serviceClient.from('car_clubs').select('id, name, slug, avatar_url').in('id', clubIds),
        serviceClient.from('profiles').select('id, username, display_name, avatar_url').in('id', inviterIds),
      ])

      const clubsMap = new Map(clubsRes.data?.map(c => [c.id, c]) || [])
      const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || [])

      const enriched = invitations.map(inv => ({
        ...inv,
        club: clubsMap.get(inv.club_id) || null,
        inviter: profilesMap.get(inv.inviter_id) || null,
      }))

      return NextResponse.json({ invitations: enriched })
    }

    return NextResponse.json({ invitations: [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
