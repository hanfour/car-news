import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// DELETE: 離開車友會
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // RLS 允許成員/owner 看到私人 club
    const { data: club } = await supabase
      .from('car_clubs')
      .select('id, owner_id')
      .eq('slug', slug)
      .single()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    if (club.owner_id === userId) {
      return NextResponse.json({ error: '創辦人不能離開車友會' }, { status: 400 })
    }

    const { error } = await supabase
      .from('car_club_members')
      .delete()
      .eq('club_id', club.id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: '離開失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
