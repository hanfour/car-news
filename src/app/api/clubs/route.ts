import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 車友會列表
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const brand = searchParams.get('brand')
    const offset = (page - 1) * limit

    let query = supabase
      .from('car_clubs')
      .select('*', { count: 'exact' })
      .eq('is_public', true)

    if (brand) {
      query = query.eq('brand', brand)
    }

    const { data: clubs, count, error } = await query
      .order('member_count', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({
      clubs: clubs || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 建立車友會
export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { name, slug, description, brand, model } = await request.json()

    if (!name || !slug) {
      return NextResponse.json({ error: '名稱和網址代碼為必填' }, { status: 400 })
    }

    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      return NextResponse.json({ error: '網址代碼只能包含小寫字母、數字和連字號' }, { status: 400 })
    }

    // 檢查 slug 唯一性
    const { data: existing } = await supabase
      .from('car_clubs')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '此網址代碼已被使用' }, { status: 409 })
    }

    const { data: club, error } = await supabase
      .from('car_clubs')
      .insert({
        name,
        slug,
        description: description || null,
        brand: brand || null,
        model: model || null,
        owner_id: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('[Clubs POST] Error:', error)
      return NextResponse.json({ error: '建立失敗' }, { status: 500 })
    }

    // 創建者自動成為 owner 成員
    await supabase.from('car_club_members').insert({
      club_id: club.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    })

    return NextResponse.json({ club })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
