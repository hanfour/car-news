import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = createServiceClient()

    // Find user
    let userId = username
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (profile) userId = profile.id

    // Get memberships
    const { data: memberships } = await supabase
      .from('car_club_members')
      .select('club_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    // Also owned clubs
    const { data: ownedClubs } = await supabase
      .from('car_clubs')
      .select('id')
      .eq('owner_id', userId)

    const allClubIds = [
      ...new Set([
        ...(memberships?.map(m => m.club_id) || []),
        ...(ownedClubs?.map(c => c.id) || []),
      ]),
    ]

    if (allClubIds.length === 0) {
      return NextResponse.json({ clubs: [] })
    }

    const { data: clubs } = await supabase
      .from('car_clubs')
      .select('id, name, slug, description, brand, avatar_url, member_count')
      .in('id', allClubIds)
      .order('name')

    return NextResponse.json({ clubs: clubs || [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
