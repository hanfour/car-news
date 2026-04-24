import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

/**
 * Full-text search API using PostgreSQL tsvector
 * 10x faster than ILIKE queries
 */
export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed } = rateLimit(`search:${clientIp}`, { maxRequests: 30, windowMs: 60_000 })

  if (!allowed) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      {
        status: 429,
        headers: { 'Retry-After': '60' }
      }
    )
  }

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
      logger.error('api.search.rpc_fail', error, { query })
      // Fallback to simple ILIKE if function doesn't exist
      return await fallbackSearch(supabase, query)
    }

    return NextResponse.json(
      { articles: data || [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    )
  } catch (error) {
    logger.error('api.search.unexpected', error, { query })
    return NextResponse.json({ articles: [] })
  }
}

/**
 * Fallback search using ILIKE (slower but works without migration)
 */
async function fallbackSearch(supabase: SupabaseClient, query: string) {
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
    .or(`title_zh.ilike.%${sanitizedQuery}%`)
    .order('published_at', { ascending: false })
    .limit(30)

  if (error) {
    logger.error('api.search.fallback_fail', error, { query })
    return NextResponse.json({ articles: [] })
  }

  return NextResponse.json(
    { articles: data || [] },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
  )
}
