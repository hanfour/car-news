import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  // 完全複製分類頁面的查詢
  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, source_date, view_count, share_count, created_at, brands, car_models, categories, tags, cover_image')
    .eq('published', true)
    .contains('categories', ['新車'])
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    error: error?.message || null,
    count: data?.length || 0,
    articles: data?.map(a => ({
      id: a.id,
      title: a.title_zh?.substring(0, 50),
      cover_image: a.cover_image,
      cover_image_length: a.cover_image?.length || 0,
      has_cover: !!a.cover_image,
      categories: a.categories
    }))
  })
}
