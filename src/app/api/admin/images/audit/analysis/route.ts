import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { ImageScoreDimensions, SCORE_WEIGHTS } from '@/lib/experiments/types'

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

// GET /api/admin/images/audit/analysis — detailed analysis report
export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get the latest batch
  const { data: latestBatch } = await supabase
    .from('image_audit')
    .select('audit_batch')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestBatch) {
    return NextResponse.json({ message: 'No audit records found' })
  }

  const batch = latestBatch.audit_batch

  // Get all audit records for this batch with article info
  const { data: records, error } = await supabase
    .from('image_audit')
    .select('article_id, scores, composite_score, explanation, image_url')
    .eq('audit_batch', batch)

  if (error || !records || records.length === 0) {
    return NextResponse.json({ error: error?.message || 'No records found' }, { status: 500 })
  }

  // Get article details for these records
  const articleIds = records.map(r => r.article_id)
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, primary_brand, image_credit')
    .in('id', articleIds)

  const articleMap = new Map((articles || []).map(a => [a.id, a]))

  // 1. Per-brand average scores
  const brandScores: Record<string, { total: number; count: number }> = {}
  for (const r of records) {
    const article = articleMap.get(r.article_id)
    const brand = article?.primary_brand || 'Unknown'
    if (!brandScores[brand]) brandScores[brand] = { total: 0, count: 0 }
    brandScores[brand].total += Number(r.composite_score)
    brandScores[brand].count++
  }
  const brandAvg = Object.entries(brandScores)
    .map(([brand, { total, count }]) => ({
      brand,
      avgScore: Math.round(total / count * 100) / 100,
      count,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)

  // 2. Per-dimension averages
  const dimTotals: Record<string, number> = {}
  const dimKeys = Object.keys(SCORE_WEIGHTS) as (keyof ImageScoreDimensions)[]
  for (const key of dimKeys) dimTotals[key] = 0

  for (const r of records) {
    const scores = r.scores as ImageScoreDimensions
    for (const key of dimKeys) {
      dimTotals[key] += scores[key] || 0
    }
  }

  const dimensionAvg = dimKeys
    .map(key => ({
      dimension: key,
      avgScore: Math.round(dimTotals[key] / records.length * 100) / 100,
      weight: SCORE_WEIGHTS[key],
    }))
    .sort((a, b) => a.avgScore - b.avgScore)

  // 3. Low-score articles (composite < 7.0)
  const lowScoreArticles = records
    .filter(r => Number(r.composite_score) < 7.0)
    .map(r => {
      const article = articleMap.get(r.article_id)
      const scores = r.scores as ImageScoreDimensions
      const weakest = (Object.entries(scores) as [string, number][])
        .sort(([, a], [, b]) => a - b)[0]
      return {
        id: r.article_id,
        title: article?.title_zh || 'Unknown',
        composite_score: Number(r.composite_score),
        weakest_dimension: weakest[0],
        weakest_score: weakest[1],
      }
    })
    .sort((a, b) => a.composite_score - b.composite_score)

  // 4. AI-generated vs source images comparison
  const aiScores: number[] = []
  const sourceScores: number[] = []
  for (const r of records) {
    const article = articleMap.get(r.article_id)
    const credit = article?.image_credit || ''
    if (credit.includes('AI') || credit.includes('Flux') || credit.includes('DALL-E')) {
      aiScores.push(Number(r.composite_score))
    } else {
      sourceScores.push(Number(r.composite_score))
    }
  }

  const avg = (arr: number[]) => arr.length > 0
    ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
    : null

  // 5. Regeneration cost estimate
  const regenCount = lowScoreArticles.length
  const estimatedCost = Math.round(regenCount * 0.008 * 1000) / 1000

  return NextResponse.json({
    batch,
    totalAudited: records.length,
    overallAvgScore: avg(records.map(r => Number(r.composite_score))),
    brandAnalysis: brandAvg,
    dimensionAnalysis: dimensionAvg,
    weakestDimension: dimensionAvg[0]?.dimension || null,
    lowScoreArticles,
    sourceComparison: {
      aiGenerated: { count: aiScores.length, avgScore: avg(aiScores) },
      sourceImages: { count: sourceScores.length, avgScore: avg(sourceScores) },
    },
    regenerationEstimate: {
      count: regenCount,
      estimatedCostUsd: estimatedCost,
    },
  })
}
