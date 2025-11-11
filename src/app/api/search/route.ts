import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ articles: [] })
  }

  const supabase = createClient()

  try {
    // Search in title_zh and content_zh
    const { data, error } = await supabase
      .from('generated_articles')
      .select('id, title_zh, content_zh, published_at, cover_image, categories')
      .eq('published', true)
      .or(`title_zh.ilike.%${query}%,content_zh.ilike.%${query}%`)
      .order('published_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json({ articles: [] })
    }

    return NextResponse.json({ articles: data || [] })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ articles: [] })
  }
}
