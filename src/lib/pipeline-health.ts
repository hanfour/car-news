import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 判斷新聞產線目前是否健康。
 *
 * 用「最近一篇已發布文章多久前產生」當最終指標，而不是看某個 cron 有沒有回 200：
 * 這次停擺期間 cron 一直回報成功，真正的症狀只有「沒有新文章」。
 *
 * 狀態：
 * - ok：一切正常。
 * - degraded：還有新文章，但某個環節看起來不對（上一輪失敗、cron 太久沒跑）。
 * - stale：超過門檻沒有新文章，視為停擺。
 */
export type PipelineStatus = 'ok' | 'degraded' | 'stale'

export interface CronRunSummary {
  status: string
  at: string
}

export interface PipelineHealthInput {
  nowMs: number
  staleHours: number
  lastArticleAt: string | null
  generator: CronRunSummary | null
  scraper: CronRunSummary | null
}

export interface PipelineHealth {
  status: PipelineStatus
  hoursSinceLastArticle: number | null
  reasons: string[]
}

const DEFAULT_STALE_HOURS = 6
/** cron 每小時跑一次，超過這個時數沒有任何紀錄就代表排程可能沒在跑。 */
const CRON_SILENT_HOURS = 3
const HOUR_MS = 3_600_000

export function getStaleHours(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.ALERT_STALE_HOURS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_STALE_HOURS
}

function hoursBetween(nowMs: number, iso: string): number | null {
  const then = Date.parse(iso)
  return Number.isNaN(then) ? null : Math.max(0, (nowMs - then) / HOUR_MS)
}

export function evaluatePipelineHealth(input: PipelineHealthInput): PipelineHealth {
  const reasons: string[] = []

  const hoursSinceLastArticle = input.lastArticleAt
    ? hoursBetween(input.nowMs, input.lastArticleAt)
    : null
  const stale = hoursSinceLastArticle === null || hoursSinceLastArticle >= input.staleHours
  if (hoursSinceLastArticle === null) {
    reasons.push('no_published_article')
  } else if (stale) {
    reasons.push(`no_new_article_for_${Math.floor(hoursSinceLastArticle)}h`)
  }

  const runs: Array<[string, CronRunSummary | null]> = [
    ['generator', input.generator],
    ['scraper', input.scraper],
  ]
  for (const [name, run] of runs) {
    if (!run) {
      reasons.push(`${name}_no_run_recorded`)
      continue
    }
    if (run.status === 'error') reasons.push(`${name}_last_run_failed`)
    const age = hoursBetween(input.nowMs, run.at)
    if (age !== null && age >= CRON_SILENT_HOURS) {
      reasons.push(`${name}_silent_for_${Math.floor(age)}h`)
    }
  }

  const status: PipelineStatus = stale ? 'stale' : reasons.length > 0 ? 'degraded' : 'ok'
  return {
    status,
    hoursSinceLastArticle:
      hoursSinceLastArticle === null ? null : Math.round(hoursSinceLastArticle * 10) / 10,
    reasons,
  }
}

async function latestCronRun(
  supabase: SupabaseClient,
  jobName: string
): Promise<CronRunSummary | null> {
  const { data } = await supabase
    .from('cron_logs')
    .select('status, created_at')
    .eq('job_name', jobName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { status: data.status as string, at: data.created_at as string } : null
}

export async function loadPipelineHealth(
  supabase: SupabaseClient,
  options: { staleHours?: number; nowMs?: number } = {}
): Promise<PipelineHealth> {
  const [article, generator, scraper] = await Promise.all([
    supabase
      .from('generated_articles')
      .select('created_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    latestCronRun(supabase, 'generator'),
    latestCronRun(supabase, 'scraper'),
  ])

  return evaluatePipelineHealth({
    nowMs: options.nowMs ?? Date.now(),
    staleHours: options.staleHours ?? getStaleHours(),
    lastArticleAt: (article.data?.created_at as string | undefined) ?? null,
    generator,
    scraper,
  })
}
