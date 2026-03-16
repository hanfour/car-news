import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// POST: 加入車友會
export async function POST(
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

    // 找到 club
    const serviceClient = createServiceClient()
    const { data: club } = await serviceClient
      .from('car_clubs')
      .select('id, is_private')
      .eq('slug', slug)
      .single()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    // 私人車友會不允許自行加入
    if (club.is_private) {
      return NextResponse.json({ error: '此車友會為私人車友會，需要邀請才能加入' }, { status: 403 })
    }

    // 檢查是否已加入
    const { data: existing } = await supabase
      .from('car_club_members')
      .select('user_id')
      .eq('club_id', club.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '你已經是成員了' }, { status: 409 })
    }

    const { error } = await supabase.from('car_club_members').insert({
      club_id: club.id,
      user_id: userId,
      role: 'member',
      status: 'active',
    })

    if (error) {
      return NextResponse.json({ error: '加入失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
