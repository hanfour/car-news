import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET: 我的愛車列表
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { data, error } = await supabase
      .from('user_cars')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({ cars: data || [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 新增愛車
export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const body = await request.json()
    const { brand, model, year, trim_level, color, nickname, description, purchase_date, mileage, is_public } = body

    if (!brand || !model) {
      return NextResponse.json({ error: '品牌和車型為必填' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_cars')
      .insert({
        user_id: userId,
        brand,
        model,
        year: year || null,
        trim_level: trim_level || null,
        color: color || null,
        nickname: nickname || null,
        description: description || null,
        purchase_date: purchase_date || null,
        mileage: mileage || null,
        is_public: is_public !== false,
      })
      .select()
      .single()

    if (error) {
      logger.error('api.garage.create_fail', error, { userId })
      return NextResponse.json({ error: '新增失敗' }, { status: 500 })
    }

    return NextResponse.json({ car: data })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
