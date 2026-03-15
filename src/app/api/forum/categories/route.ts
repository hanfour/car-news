import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET: 論壇分類列表
export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[Forum Categories] Error:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({ categories: data || [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
