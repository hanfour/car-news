import type { SupabaseClient } from '@supabase/supabase-js'
import { needsHumanAction } from '@/lib/ai/errors'
import type { EmbeddingStatus } from '@/lib/ai/embedding-health'
import type { ProviderEvent } from '@/lib/ai/provider-health'
import { sendAlert, type AlertInput } from '@/lib/alerts'
import { getStaleHours, loadPipelineHealth, type PipelineHealth } from '@/lib/pipeline-health'
import { logger } from '@/lib/logger'
import type { RunGuardSummary } from './run-guard'

const PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  openai: 'OpenAI',
}

/** 補額度或換金鑰的入口。只放網站首頁，避免連結過期。 */
const PROVIDER_CONSOLE: Record<string, string> = {
  gemini: 'https://aistudio.google.com',
  claude: 'https://console.anthropic.com',
  openai: 'https://platform.openai.com',
}

/** 人需要處理的狀況在持續存在時，每 12 小時提醒一次。 */
const PERSISTENT_COOLDOWN_MINUTES = 720

export interface RunAlertContext {
  embedding: EmbeddingStatus
  /** 還沒走到生成階段就中止時為 null */
  guard: RunGuardSummary | null
  providerEvents: ProviderEvent[]
  generated: number
}

/** 依一輪的結果組出該發的告警。純函式，不做任何 I/O。 */
export function buildRunAlerts(ctx: RunAlertContext): AlertInput[] {
  const alerts: AlertInput[] = []
  const nothingGenerated = ctx.generated === 0

  const seen = new Set<string>()
  for (const event of ctx.providerEvents) {
    if (!needsHumanAction(event.kind)) continue
    const id = `${event.provider}:${event.kind}`
    if (seen.has(id)) continue
    seen.add(id)

    const label = PROVIDER_LABEL[event.provider] ?? event.provider
    const consoleUrl = PROVIDER_CONSOLE[event.provider]
    alerts.push({
      key: `provider:${id}`,
      severity: nothingGenerated ? 'error' : 'warn',
      title:
        event.kind === 'billing' ? `${label} 額度用盡或需要付款` : `${label} 金鑰無效或沒有權限`,
      details: [
        nothingGenerated ? '本輪沒有產出任何文章' : '已自動改用備援，文章仍在產出',
        `錯誤：${event.message}`,
        ...(consoleUrl ? [`處理：${consoleUrl}`] : []),
      ],
      cooldownMinutes: PERSISTENT_COOLDOWN_MINUTES,
    })
  }

  if (ctx.embedding.mode === 'fallback') {
    alerts.push({
      key: 'embedding:fallback',
      severity: 'warn',
      title: '向量嵌入的主要服務不可用，已改用備援',
      details: [
        `原因：${ctx.embedding.primaryError?.kind ?? 'unknown'}｜${ctx.embedding.primaryError?.message ?? ''}`,
        '降級模式：分群品質可能下降，且本輪不做語義重複比對，文章的向量會之後補上',
      ],
      cooldownMinutes: PERSISTENT_COOLDOWN_MINUTES,
    })
  } else if (ctx.embedding.mode === 'unavailable') {
    alerts.push({
      key: 'embedding:unavailable',
      severity: 'error',
      title: '向量嵌入服務完全不可用，本輪停止生成',
      details: [
        `主要：${ctx.embedding.primaryError?.kind ?? 'unknown'}｜${ctx.embedding.primaryError?.message ?? ''}`,
        ctx.embedding.fallbackError
          ? `備援：${ctx.embedding.fallbackError.kind}｜${ctx.embedding.fallbackError.message}`
          : '沒有可用的備援（未設定另一家的金鑰）',
      ],
      cooldownMinutes: PERSISTENT_COOLDOWN_MINUTES,
    })
  }

  const guard = ctx.guard
  // 只有一次失敗且沒產出，可能只是那一篇內容有問題，不值得叫醒人；兩次以上才發。
  if (guard && (guard.abortReason || (guard.failures >= 2 && nothingGenerated))) {
    alerts.push({
      key: 'generator:run_failed',
      severity: 'error',
      title: '文章產線本輪失敗，沒有產出文章',
      details: [
        guard.abortReason ? `提早中止：${guard.abortReason}` : '所有嘗試都失敗',
        `失敗 ${guard.failures} 次：${JSON.stringify(guard.failuresByKind)}`,
      ],
      cooldownMinutes: 180,
    })
  }

  return alerts
}

const REASON_PATTERNS: ReadonlyArray<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^generator_last_run_failed$/, () => '上一輪文章生成失敗'],
  [/^scraper_last_run_failed$/, () => '上一輪文章抓取失敗'],
  [/^generator_silent_for_(\d+)h$/, (m) => `文章生成排程已 ${m[1]} 小時沒有執行紀錄`],
  [/^scraper_silent_for_(\d+)h$/, (m) => `文章抓取排程已 ${m[1]} 小時沒有執行紀錄`],
  [/^generator_no_run_recorded$/, () => '找不到文章生成的執行紀錄'],
  [/^scraper_no_run_recorded$/, () => '找不到文章抓取的執行紀錄'],
]

function describeReason(code: string): string | null {
  for (const [pattern, describe] of REASON_PATTERNS) {
    const match = code.match(pattern)
    if (match) return describe(match)
  }
  return null // 例如 no_new_article_for_Nh：標題已經說了
}

export function buildStaleAlert(health: PipelineHealth, staleHours: number): AlertInput | null {
  if (health.status !== 'stale') return null
  const title =
    health.hoursSinceLastArticle === null
      ? '網站還沒有任何已發布的文章'
      : `已 ${Math.floor(health.hoursSinceLastArticle)} 小時沒有新發布的文章`
  return {
    key: 'pipeline:stale',
    severity: 'error',
    title,
    details: [
      `門檻：${staleHours} 小時`,
      ...health.reasons.map(describeReason).filter((line): line is string => line !== null),
    ],
    cooldownMinutes: 360,
  }
}

export interface WatchdogDeps {
  load: typeof loadPipelineHealth
  send: (alert: AlertInput) => Promise<unknown>
  staleHours: number
}

/**
 * 看門狗：不論這一輪後面做了什麼，先看一眼「到底有沒有新文章」。
 * 放在最前面是因為後面的流程可能提早 return、超時或當掉。
 * 永遠不 throw。
 */
export async function checkPipelineStale(
  supabase: SupabaseClient,
  deps: Partial<WatchdogDeps> = {}
): Promise<PipelineHealth | null> {
  const load = deps.load ?? loadPipelineHealth
  const send = deps.send ?? sendAlert
  const staleHours = deps.staleHours ?? getStaleHours()
  try {
    const health = await load(supabase, { staleHours })
    const alert = buildStaleAlert(health, staleHours)
    if (alert) await send(alert)
    return health
  } catch (error) {
    logger.error('cron.generator.watchdog_fail', error)
    return null
  }
}

/** 依一輪的結果送出告警。永遠不 throw。 */
export async function notifyRunResult(
  ctx: RunAlertContext,
  send: (alert: AlertInput) => Promise<unknown> = sendAlert
): Promise<void> {
  try {
    for (const alert of buildRunAlerts(ctx)) await send(alert)
  } catch (error) {
    logger.error('cron.generator.notify_fail', error)
  }
}
