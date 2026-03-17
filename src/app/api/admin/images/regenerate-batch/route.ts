import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { generateCoverImage, generateAndSaveCoverImage } from '@/lib/ai/image-generation'
import { scoreImage } from '@/lib/experiments/scorer'

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

// POST /api/admin/images/regenerate-batch — batch regenerate low-score images
export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let threshold = 7.0
  let maxCount = 20
  let dryRun = false

  try {
    const body = await request.json()
    if (typeof body.threshold === 'number') threshold = body.threshold
    if (typeof body.maxCount === 'number') maxCount = Math.min(body.maxCount, 50)
    if (typeof body.dryRun === 'boolean') dryRun = body.dryRun
  } catch {
    // Use defaults
  }

  const supabase = createServiceClient()

  // Get low-score audit records, sorted by score ascending (worst first)
  const { data: auditRecords, error: auditError } = await supabase
    .from('image_audit')
    .select('article_id, composite_score, scores')
    .lt('composite_score', threshold)
    .order('composite_score', { ascending: true })
    .limit(maxCount)

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 })
  }

  if (!auditRecords || auditRecords.length === 0) {
    return NextResponse.json({
      message: `No articles below threshold ${threshold}`,
      regenerated: 0,
    })
  }

  // Get article details
  const articleIds = auditRecords.map(r => r.article_id)
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, brands, primary_brand, images, image_credit')
    .in('id', articleIds)

  const articleMap = new Map((articles || []).map(a => [a.id, a]))

  if (dryRun) {
    const dryRunResults = auditRecords.map(r => {
      const article = articleMap.get(r.article_id)
      const images = article?.images as Array<{ url: string }> | null
      return {
        article_id: r.article_id,
        title: article?.title_zh || 'Unknown',
        current_score: Number(r.composite_score),
        method: images && images.length > 0 ? 'img2img' : 'text2img+qualityBoost',
        estimated_cost: images && images.length > 0 ? 0.025 : 0.008,
      }
    })

    const totalCost = dryRunResults.reduce((s, r) => s + r.estimated_cost, 0)

    return NextResponse.json({
      dryRun: true,
      threshold,
      count: dryRunResults.length,
      estimatedCostUsd: Math.round(totalCost * 1000) / 1000,
      articles: dryRunResults,
    })
  }

  // Actual regeneration
  console.log(`→ Starting batch regeneration: ${auditRecords.length} articles below ${threshold}`)

  const details: Array<{
    article_id: string
    title: string
    scoreBefore: number
    scoreAfter: number | null
    improved: boolean
    error?: string
  }> = []

  let totalScoreBefore = 0
  let totalScoreAfter = 0
  let improvedCount = 0

  for (let i = 0; i < auditRecords.length; i++) {
    const record = auditRecords[i]
    const article = articleMap.get(record.article_id)
    if (!article) continue

    const scoreBefore = Number(record.composite_score)
    totalScoreBefore += scoreBefore

    console.log(`  [${i + 1}/${auditRecords.length}] Regenerating: ${article.title_zh.slice(0, 40)}... (score: ${scoreBefore})`)

    try {
      const brands = article.brands as string[] || (article.primary_brand ? [article.primary_brand] : undefined)
      const images = article.images as Array<{ url: string; caption?: string; size?: number }> | null

      let newUrl: string | null = null
      let newCredit = ''

      if (images && images.length > 0) {
        // img2img path
        const result = await generateAndSaveCoverImage(
          article.title_zh, article.content_zh, brands, images
        )
        if (result) {
          newUrl = result.url
          newCredit = result.credit
        }
      } else {
        // text2img with qualityBoost
        const result = await generateCoverImage(
          article.title_zh, article.content_zh, brands, 'auto', true
        )
        if (result?.url) {
          // Upload to permanent storage
          const { uploadImageFromUrl } = await import('@/lib/storage/image-uploader')
          const brand = article.primary_brand || 'article'
          const fileName = `regen-${brand.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
          const permanentUrl = await uploadImageFromUrl(result.url, fileName, true)
          newUrl = permanentUrl || result.url
          newCredit = `AI 生成示意圖 (${result.provider === 'flux' ? 'Flux' : 'DALL-E 3'} QB)`
        }
      }

      if (!newUrl) {
        details.push({ article_id: article.id, title: article.title_zh, scoreBefore, scoreAfter: null, improved: false, error: 'Generation failed' })
        continue
      }

      // Update article
      await supabase
        .from('generated_articles')
        .update({ cover_image: newUrl, image_credit: newCredit })
        .eq('id', article.id)

      // Re-score to verify improvement
      let scoreAfter: number | null = null
      try {
        const newScore = await scoreImage(newUrl, article.title_zh, newCredit)
        scoreAfter = newScore.composite

        // Save new audit record
        const now = new Date()
        const regenBatch = `regen-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
        await supabase.from('image_audit').insert({
          article_id: article.id,
          image_url: newUrl,
          scores: newScore.dimensions,
          composite_score: newScore.composite,
          explanation: newScore.explanation,
          audit_batch: regenBatch,
        })
      } catch {
        // Scoring failed but regeneration succeeded
      }

      const improved = scoreAfter !== null && scoreAfter > scoreBefore
      if (improved) improvedCount++
      if (scoreAfter !== null) totalScoreAfter += scoreAfter

      details.push({
        article_id: article.id,
        title: article.title_zh,
        scoreBefore,
        scoreAfter,
        improved,
      })

      console.log(`    ✓ ${scoreAfter !== null ? `Score: ${scoreBefore} → ${scoreAfter} (${improved ? '↑' : '↓'})` : 'Regenerated (no re-score)'}`)
    } catch (error) {
      details.push({
        article_id: article.id,
        title: article.title_zh,
        scoreBefore,
        scoreAfter: null,
        improved: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      console.error(`    ✗ Failed:`, error instanceof Error ? error.message : error)
    }

    // Rate limit between regenerations
    if (i < auditRecords.length - 1) {
      await sleep(1000)
    }
  }

  const scoredCount = details.filter(d => d.scoreAfter !== null).length
  const avgScoreBefore = Math.round(totalScoreBefore / details.length * 100) / 100
  const avgScoreAfter = scoredCount > 0 ? Math.round(totalScoreAfter / scoredCount * 100) / 100 : null

  console.log(`✓ Batch regeneration complete: ${details.length} processed, ${improvedCount} improved`)

  return NextResponse.json({
    regenerated: details.length,
    improved: improvedCount,
    avgScoreBefore,
    avgScoreAfter,
    details,
  })
}
