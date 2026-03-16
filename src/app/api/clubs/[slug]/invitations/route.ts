import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// GET: 車友會邀請列表（owner/admin 可查看）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase } = auth
    const { slug } = await params

    // 查 club id
    const { data: club } = await supabase
      .from('car_clubs')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    const { data: invitations, error } = await supabase
      .from('club_invitations')
      .select('*')
      .eq('club_id', club.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // Fetch invitee profiles
    if (invitations && invitations.length > 0) {
      const serviceClient = auth.getServiceClient()
      const userIds = [...new Set(invitations.map(i => i.invitee_id))]
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])
      const enriched = invitations.map(inv => ({
        ...inv,
        invitee: profilesMap.get(inv.invitee_id) || null,
      }))

      return NextResponse.json({ invitations: enriched })
    }

    return NextResponse.json({ invitations: [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 建立邀請
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth
    const { slug } = await params

    const rl = rateLimit(`club-invite:${userId}`, { maxRequests: 20, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { username, message } = await request.json()
    if (!username) {
      return NextResponse.json({ error: '請提供使用者名稱' }, { status: 400 })
    }

    // 查 club
    const { data: club } = await supabase
      .from('car_clubs')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    // 查被邀請者
    const serviceClient = auth.getServiceClient()
    const { data: invitee } = await serviceClient
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', username)
      .single()

    if (!invitee) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    if (invitee.id === userId) {
      return NextResponse.json({ error: '不能邀請自己' }, { status: 400 })
    }

    // 檢查是否已是成員
    const { data: existing } = await serviceClient
      .from('car_club_members')
      .select('user_id')
      .eq('club_id', club.id)
      .eq('user_id', invitee.id)
      .eq('status', 'active')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '此使用者已是成員' }, { status: 400 })
    }

    // 建立邀請（RLS 會檢查 inviter 是否為 owner/admin）
    const { data: invitation, error } = await supabase
      .from('club_invitations')
      .insert({
        club_id: club.id,
        inviter_id: userId,
        invitee_id: invitee.id,
        message: message || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '已經邀請過此使用者' }, { status: 400 })
      }
      console.error('[Club Invitations POST] Error:', error)
      return NextResponse.json({ error: '邀請失敗' }, { status: 500 })
    }

    return NextResponse.json({ invitation })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
