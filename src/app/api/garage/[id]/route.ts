import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 愛車詳情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()

    const { data: car, error } = await supabase
      .from('user_cars')
      .select('id, user_id, brand, model, year, trim_level, color, nickname, description, purchase_date, mileage, is_primary, is_public, images, specs, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !car) {
      return NextResponse.json({ error: '找不到此車輛' }, { status: 404 })
    }

    // 私人車輛只有車主本人可查看
    if (!car.is_public) {
      const auth = await createAuthenticatedClient(request)
      if (!auth || auth.userId !== car.user_id) {
        return NextResponse.json({ error: '找不到此車輛' }, { status: 404 })
      }
    }

    // 查詢車主 profile
    const { data: owner } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', car.user_id)
      .single()

    return NextResponse.json({ car: { ...car, owner } })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// PATCH: 更新愛車
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const body = await request.json()
    const allowedFields = ['brand', 'model', 'year', 'trim_level', 'color', 'nickname', 'description', 'purchase_date', 'mileage', 'is_primary', 'is_public', 'cover_image', 'images']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }

    const { data, error } = await supabase
      .from('user_cars')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ car: data })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 刪除愛車
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { error } = await supabase
      .from('user_cars')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
