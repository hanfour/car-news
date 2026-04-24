import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// GET: 論壇分類列表
export async function GET() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      logger.error('api.forum.categories_list_fail', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({ categories: data || [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
