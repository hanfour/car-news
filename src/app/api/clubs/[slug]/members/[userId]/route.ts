import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  try {
    const { slug, userId: targetUserId } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { userId: currentUserId } = auth
    const supabase = createServiceClient()

    // Get club
    const { data: club } = await supabase
      .from('car_clubs')
      .select('id, owner_id')
      .eq('slug', slug)
      .single()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    // Check permissions - only owner or admin can manage members
    const isOwner = currentUserId === club.owner_id
    let isAdmin = false

    if (!isOwner) {
      const { data: membership } = await supabase
        .from('car_club_members')
        .select('role')
        .eq('club_id', club.id)
        .eq('user_id', currentUserId)
        .eq('status', 'active')
        .single()

      isAdmin = membership?.role === 'admin'
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
    }

    // Cannot modify owner
    if (targetUserId === club.owner_id) {
      return NextResponse.json({ error: '無法修改創辦人' }, { status: 403 })
    }

    // Only owner can promote/demote admins
    const body = await request.json()
    const { role, status } = body

    const updates: Record<string, unknown> = {}
    if (role && isOwner) {
      updates.role = role
    }
    if (status) {
      updates.status = status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '無效的更新' }, { status: 400 })
    }

    const { error } = await supabase
      .from('car_club_members')
      .update(updates)
      .eq('club_id', club.id)
      .eq('user_id', targetUserId)

    if (error) {
      console.error('[Club Member PATCH] Error:', error)
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Club Member PATCH] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
