import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

// GET: 推薦車友會（基於使用者的愛車品牌）
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const auth = await createAuthenticatedClient(request)

    let userBrands: string[] = []

    if (auth) {
      // 取得使用者的愛車品牌（使用 RLS client 查自己的車）
      const { data: cars } = await auth.supabase
        .from('user_cars')
        .select('brand')
        .eq('user_id', auth.userId)

      if (cars) {
        userBrands = [...new Set(cars.map(c => c.brand))]
      }
    }

    // 推薦邏輯：優先推薦與使用者愛車品牌相符的車友會
    let query = supabase
      .from('car_clubs')
      .select('*')
      .eq('is_public', true)
      .order('member_count', { ascending: false })
      .limit(10)

    if (userBrands.length > 0) {
      query = query.in('brand', userBrands)
    }

    const { data: clubs, error } = await query

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 如果基於品牌推薦不夠，補上熱門車友會
    let result = clubs || []
    if (result.length < 5) {
      const existingIds = result.map(c => c.id)
      let popularQuery = supabase
        .from('car_clubs')
        .select('*')
        .eq('is_public', true)
        .order('member_count', { ascending: false })
        .limit(5 - result.length)

      if (existingIds.length > 0) {
        popularQuery = popularQuery.not('id', 'in', `(${existingIds.join(',')})`)
      }

      const { data: popular } = await popularQuery

      if (popular) {
        result = [...result, ...popular]
      }
    }

    return NextResponse.json({ clubs: result })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
