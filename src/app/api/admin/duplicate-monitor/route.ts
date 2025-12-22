import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  findSemanticDuplicatesInBatch,
  findKeywordDuplicatesInBatch,
  ArticleForDuplicateCheck
} from '@/lib/utils/advanced-deduplication'
import { verifySessionToken } from '@/lib/admin/session'
import { getErrorMessage } from '@/lib/utils/error'

export const dynamic = 'force-dynamic'

// Secure API Key validation
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

async function verifyAuth(request: NextRequest): Promise<boolean> {
  // 方式 1: Bearer token (用於 API 調用)
  const authHeader = request.headers.get('authorization')
  if (ADMIN_API_KEY && authHeader === `Bearer ${ADMIN_API_KEY}`) {
    return true
  }

  // 方式 2: Cookie session (用於 Web UI)
  const sessionCookie = request.cookies.get('admin_session')
  if (sessionCookie?.value) {
    const userId = await verifySessionToken(sessionCookie.value)
    if (!userId) {
      return false
    }

    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    return data?.is_admin === true
  }

  return false
}

/**
 * Duplicate Monitor API
 *
 * Analyzes recent articles for potential duplicates using:
 * 1. Embedding similarity (semantic)
 * 2. Keyword overlap (topic)
 * 3. Brand frequency violations
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    // Get all articles from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: articles, error } = await supabase
      .from('generated_articles')
      .select('id, title_zh, primary_brand, created_at, published, view_count, content_embedding')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (error || !articles) {
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
    }

    // 使用共用函數檢測重複
    const articlesForCheck: ArticleForDuplicateCheck[] = articles.map(a => ({
      id: a.id,
      title_zh: a.title_zh,
      created_at: a.created_at,
      published: a.published,
      view_count: a.view_count || 0,
      content_embedding: a.content_embedding,
      primary_brand: a.primary_brand
    }))

    // 1. Find semantic duplicates (embedding similarity > 90%)
    const semanticDuplicates = findSemanticDuplicatesInBatch(articlesForCheck, 0.90)

    // 2. Find keyword duplicates (overlap > 70%)
    const keywordDuplicatesRaw = findKeywordDuplicatesInBatch(articlesForCheck, 0.70, 2)
    const keywordDuplicates = keywordDuplicatesRaw.map(d => ({
      ...d,
      overlap: d.similarity // 保持 API 兼容性
    }))

    // 3. Find brand frequency violations (>3 articles in 24h)
    const last24h = new Date()
    last24h.setHours(last24h.getHours() - 24)

    const { data: recent24h } = await supabase
      .from('generated_articles')
      .select('id, title_zh, primary_brand, created_at')
      .gte('created_at', last24h.toISOString())
      .not('primary_brand', 'is', null)
      .order('created_at', { ascending: false })

    const brandCounts = new Map<string, Array<{ id: string; title_zh: string; created_at: string }>>()

    if (recent24h) {
      for (const article of recent24h) {
        const brand = article.primary_brand!
        if (!brandCounts.has(brand)) {
          brandCounts.set(brand, [])
        }
        brandCounts.get(brand)!.push({
          id: article.id,
          title_zh: article.title_zh,
          created_at: article.created_at
        })
      }
    }

    const brandViolations = Array.from(brandCounts.entries())
      .filter(([_, articles]) => articles.length > 3)
      .map(([brand, articles]) => ({
        brand,
        count: articles.length,
        articles: articles.slice(0, 5) // Show first 5
      }))
      .sort((a, b) => b.count - a.count)

    // 4. Summary statistics
    const stats = {
      totalArticles: articles.length,
      articlesWithEmbedding: articlesForCheck.filter(a => a.content_embedding).length,
      semanticDuplicatesCount: semanticDuplicates.length,
      keywordDuplicatesCount: keywordDuplicates.length,
      brandViolationsCount: brandViolations.length,
      publishedArticles: articles.filter(a => a.published).length
    }

    return NextResponse.json({
      stats,
      semanticDuplicates: semanticDuplicates.slice(0, 20), // Top 20
      keywordDuplicates: keywordDuplicates.slice(0, 20), // Top 20
      brandViolations
    })

  } catch (error) {
    console.error('[Duplicate Monitor] Error:', getErrorMessage(error))
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
