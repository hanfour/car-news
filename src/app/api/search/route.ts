import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Full-text search API using PostgreSQL tsvector
 * 10x faster than ILIKE queries
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ articles: [] })
  }

  const supabase = createClient()

  try {
    // Use PostgreSQL full-text search function
    const { data, error } = await supabase
      .rpc('search_articles', {
        search_query: query.trim(),
        result_limit: 30
      })

    if (error) {
      console.error('Search error:', error)
      // Fallback to simple ILIKE if function doesn't exist
      return await fallbackSearch(supabase, query)
    }

    return NextResponse.json({ articles: data || [] })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ articles: [] })
  }
}

/**
 * Fallback search using ILIKE (slower but works without migration)
 */
async function fallbackSearch(supabase: any, query: string) {
  // Sanitize query to prevent performance attacks
  // Escape special ILIKE characters: % and _
  const sanitizedQuery = query.replace(/[%_]/g, '\\$&').trim()

  if (sanitizedQuery.length < 2) {
    return NextResponse.json({ articles: [] })
  }

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, cover_image, categories')
    .eq('published', true)
    .or(`title_zh.ilike.%${sanitizedQuery}%,content_zh.ilike.%${sanitizedQuery}%`)
    .order('published_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Fallback search error:', error)
    return NextResponse.json({ articles: [] })
  }

  return NextResponse.json({ articles: data || [] })
}
