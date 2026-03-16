import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get current car
    const { data: car } = await supabase
      .from('user_cars')
      .select('brand, model')
      .eq('id', id)
      .single()

    if (!car) {
      return NextResponse.json({ cars: [] })
    }

    // Find related cars (same brand, different car)
    const { data: related } = await supabase
      .from('user_cars')
      .select('id, brand, model, year, nickname, cover_image, user_id')
      .eq('brand', car.brand)
      .eq('is_public', true)
      .neq('id', id)
      .limit(6)

    if (!related || related.length === 0) {
      return NextResponse.json({ cars: [] })
    }

    // Get owners
    const userIds = [...new Set(related.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds)

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const cars = related.map(c => ({
      ...c,
      owner: profilesMap.get(c.user_id) || null,
    }))

    return NextResponse.json({ cars })
  } catch {
    return NextResponse.json({ cars: [] })
  }
}
