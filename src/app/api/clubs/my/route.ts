import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // 查詢用戶加入的車友會
    const { data: memberships, error: memberError } = await supabase
      .from('car_club_members')
      .select('club_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (memberError) {
      console.error('[Clubs My GET] Member query error:', memberError)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      // Also check clubs owned by the user
      const { data: ownedClubs } = await supabase
        .from('car_clubs')
        .select('id, name, slug, avatar_url')
        .eq('owner_id', userId)
        .order('name')

      return NextResponse.json({ clubs: ownedClubs || [] })
    }

    const clubIds = memberships.map(m => m.club_id)

    // Also include owned clubs
    const { data: ownedClubs } = await supabase
      .from('car_clubs')
      .select('id')
      .eq('owner_id', userId)

    const allClubIds = [...new Set([...clubIds, ...(ownedClubs?.map(c => c.id) || [])])]

    const { data: clubs, error: clubError } = await supabase
      .from('car_clubs')
      .select('id, name, slug, avatar_url')
      .in('id', allClubIds)
      .order('name')

    if (clubError) {
      console.error('[Clubs My GET] Club query error:', clubError)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({ clubs: clubs || [] })
  } catch (error) {
    console.error('[Clubs My GET] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
