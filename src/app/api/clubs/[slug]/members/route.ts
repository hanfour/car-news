import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = createClient()

    // Get club
    const { data: club } = await supabase
      .from('car_clubs')
      .select('id, owner_id')
      .eq('slug', slug)
      .single()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    // Get members（限制最多 200 筆）
    const { data: members, error } = await supabase
      .from('car_club_members')
      .select('user_id, role, status, joined_at')
      .eq('club_id', club.id)
      .eq('status', 'active')
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('[Club Members GET] Error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // Get profiles
    const userIds = members?.map(m => m.user_id) || []
    // Include owner if not already a member
    if (!userIds.includes(club.owner_id)) {
      userIds.push(club.owner_id)
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds)

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // Build result - ensure owner is included
    const result = (members || []).map(m => ({
      ...m,
      role: m.user_id === club.owner_id ? 'owner' : m.role,
      profile: profilesMap.get(m.user_id) || null,
    }))

    // If owner not in members list, add them
    if (!result.some(m => m.user_id === club.owner_id)) {
      result.unshift({
        user_id: club.owner_id,
        role: 'owner',
        status: 'active',
        joined_at: '',
        profile: profilesMap.get(club.owner_id) || null,
      })
    }

    return NextResponse.json({ members: result })
  } catch (error) {
    console.error('[Club Members GET] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
