import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStaleHours, loadPipelineHealth } from '@/lib/pipeline-health'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * 產線健康檢查，給外部的 uptime 監控（UptimeRobot、Better Stack 等）定時呼叫。
 *
 * 判斷依據是「最近一篇已發布文章多久前產生」，不是 cron 回不回 200，
 * 所以連 Vercel 排程本身掛掉的情況也能被外部監控抓到。
 *
 * - 200：ok 或 degraded
 * - 503：stale（超過門檻沒有新文章）或無法判斷
 * - 加上 ?strict=1 時，degraded 也回 503
 *
 * 只回傳摘要與簡短原因代碼，不含任何錯誤內文或密鑰，因此不需要驗證。
 */
export async function GET(request: Request) {
  const strict = new URL(request.url).searchParams.get('strict') === '1'

  try {
    const health = await loadPipelineHealth(createServiceClient(), { staleHours: getStaleHours() })
    const failing = health.status === 'stale' || (strict && health.status === 'degraded')

    return NextResponse.json(
      {
        ok: !failing,
        status: health.status,
        hoursSinceLastArticle: health.hoursSinceLastArticle,
        reasons: health.reasons,
      },
      {
        status: failing ? 503 : 200,
        // 讓 CDN 吸收重複請求；監控頻率通常是 1 到 5 分鐘，快取 60 秒不影響判斷。
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      }
    )
  } catch (error) {
    logger.error('health.pipeline.fail', error)
    return NextResponse.json(
      { ok: false, status: 'unknown' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
