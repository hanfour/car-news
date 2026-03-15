import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 車友會詳情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = createServiceClient()

    const { data: club, error } = await supabase
      .from('car_clubs')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }

    // 查詢 owner profile
    const { data: owner } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', club.owner_id)
      .single()

    return NextResponse.json({ club: { ...club, owner } })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// PATCH: 更新車友會
export async function PATCH(
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

    const body = await request.json()
    const allowedFields = ['name', 'description', 'brand', 'model', 'is_public']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }

    const { data, error } = await supabase
      .from('car_clubs')
      .update(updates)
      .eq('slug', slug)
      .eq('owner_id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ club: data })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
