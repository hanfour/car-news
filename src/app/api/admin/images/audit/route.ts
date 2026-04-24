import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { scoreImage } from '@/lib/experiments/scorer'
import { ImageScoreDimensions } from '@/lib/experiments/types'
import { logger } from '@/lib/logger'

export const maxDuration = 300 // 5 分鐘

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${ADMIN_API_KEY}`) return true

  const sessionCookie = request.cookies.get('admin_session')
  if (sessionCookie?.value) {
    const userId = await verifySessionToken(sessionCookie.value)
    if (!userId) return false
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// POST /api/admin/images/audit — trigger full audit
export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Parse optional body for articleIds filter and force mode
  let filterIds: string[] | null = null
  let force = false
  try {
    const body = await request.json()
    if (Array.isArray(body.articleIds)) filterIds = body.articleIds
    if (body.force === true) force = true
  } catch {
    // No body or parse error — audit all
  }

  // Get published articles with cover images
  let query = supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, image_credit')
    .eq('published', true)
    .not('cover_image', 'is', null)
    .order('created_at', { ascending: true })

  if (filterIds && filterIds.length > 0) {
    query = query.in('id', filterIds)
  }

  const { data: articles, error: fetchError } = await query

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: 'No published articles with cover images found' })
  }

  // Exclude already-audited unless force=true
  let toAudit = articles
  if (!force) {
    const { data: existingAudits } = await supabase
      .from('image_audit')
      .select('article_id')

    const auditedIds = new Set((existingAudits || []).map(a => a.article_id))
    toAudit = articles.filter(a => !auditedIds.has(a.id))
  }

  if (toAudit.length === 0) {
    return NextResponse.json({ message: 'All published articles already audited', total: articles.length })
  }

  const now = new Date()
  const batch = `audit-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

  const results: Array<{ article_id: string; composite_score: number; weakest: string }> = []
  let errorCount = 0

  logger.info('api.admin.image_audit_start', { batch, total: toAudit.length })

  for (let i = 0; i < toAudit.length; i++) {
    const article = toAudit[i]

    try {
      logger.info('api.admin.image_audit_score', {
        batch,
        index: i + 1,
        total: toAudit.length,
        articleId: article.id,
      })

      const score = await scoreImage(
        article.cover_image!,
        article.title_zh,
        article.image_credit || ''
      )

      // Insert audit record
      await supabase.from('image_audit').insert({
        article_id: article.id,
        image_url: article.cover_image!,
        scores: score.dimensions,
        composite_score: score.composite,
        explanation: score.explanation,
        audit_batch: batch,
      })

      // Find weakest dimension
      const dims = score.dimensions as ImageScoreDimensions
      const weakest = (Object.entries(dims) as [string, number][])
        .sort(([, a], [, b]) => a - b)[0][0]

      results.push({
        article_id: article.id,
        composite_score: score.composite,
        weakest,
      })

      logger.info('api.admin.image_audit_scored', {
        articleId: article.id,
        composite: score.composite,
        weakest,
      })
    } catch (error) {
      errorCount++
      logger.error('api.admin.image_audit_item_fail', error, { articleId: article.id })
    }

    // Rate limit: pause every 3 images
    if ((i + 1) % 3 === 0 && i < toAudit.length - 1) {
      await sleep(500)
    }
  }

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.composite_score, 0) / results.length * 100) / 100
    : 0

  const belowThreshold = results.filter(r => r.composite_score < 7.0).length

  // Count top issues (weakest dimensions)
  const issueCounts: Record<string, number> = {}
  for (const r of results) {
    issueCounts[r.weakest] = (issueCounts[r.weakest] || 0) + 1
  }
  const topIssues = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([dim, count]) => ({ dimension: dim, count }))

  logger.info('api.admin.image_audit_complete', {
    batch,
    scored: results.length,
    errors: errorCount,
    avgScore,
  })

  return NextResponse.json({
    batch,
    audited: results.length,
    errors: errorCount,
    avgScore,
    belowThreshold,
    topIssues,
  })
}

// GET /api/admin/images/audit — query audit results
export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const batchFilter = searchParams.get('batch')

  // Get the latest batch if no specific batch requested
  let batch = batchFilter
  if (!batch) {
    const { data: latestBatch } = await supabase
      .from('image_audit')
      .select('audit_batch')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestBatch) {
      return NextResponse.json({ message: 'No audit records found', records: [] })
    }
    batch = latestBatch.audit_batch
  }

  // Get all records for the batch
  const { data: records, error } = await supabase
    .from('image_audit')
    .select('*')
    .eq('audit_batch', batch)
    .order('composite_score', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const scores = (records || []).map(r => r.composite_score as number)
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 100) / 100
    : 0
  const belowThreshold = scores.filter(s => s < 7.0).length

  return NextResponse.json({
    batch,
    total: records?.length || 0,
    avgScore,
    belowThreshold,
    records,
  })
}
