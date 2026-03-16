import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET: 愛車展示牆（公開）
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const brand = searchParams.get('brand')
    const offset = (page - 1) * limit

    let query = supabase
      .from('user_cars')
      .select('*', { count: 'exact' })
      .eq('is_public', true)

    if (brand) {
      query = query.eq('brand', brand)
    }

    const { data: cars, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 查詢車主 profiles
    if (cars && cars.length > 0) {
      const userIds = [...new Set(cars.map(c => c.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      const carsWithOwners = cars.map(car => ({
        ...car,
        owner: profilesMap.get(car.user_id) || null,
      }))

      return NextResponse.json({
        cars: carsWithOwners,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      })
    }

    return NextResponse.json({ cars: [], total: 0, page: 1, totalPages: 0 })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
