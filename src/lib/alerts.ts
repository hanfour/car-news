import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error'
import { redactSecrets } from '@/lib/utils/redact'

/**
 * 把「產線出事了」主動推到人眼前，而不是等人去翻 log 才發現。
 *
 * 管道（至少設一個才會送出）：
 * - ALERT_WEBHOOK_URL：Slack / Discord 的 incoming webhook（同時送 text 與 content 兩個欄位）。
 * - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID：Telegram bot。
 *
 * 同一個 key 在冷卻時間內只送一次（預設 6 小時），避免每小時的 cron 洗版。
 * 冷卻紀錄存在 cron_logs（job_name = 'alert'），不需要新的資料表。
 *
 * 這個函式永遠不 throw：告警失敗不能讓原本的 cron 跟著失敗。
 */
export type AlertSeverity = 'info' | 'warn' | 'error'

export interface AlertInput {
  /** 去重用的識別字，例如 provider:gemini:billing */
  key: string
  severity: AlertSeverity
  title: string
  details?: string[]
  /** 同一個 key 兩次通知之間至少間隔幾分鐘，預設 360 */
  cooldownMinutes?: number
}

export interface AlertChannelConfig {
  webhookUrl?: string
  telegramBotToken?: string
  telegramChatId?: string
  siteName?: string
}

export interface AlertStore {
  lastSentAt: (key: string) => Promise<number | null>
  markSent: (key: string, meta: Record<string, unknown>) => Promise<void>
}

export interface AlertDeps {
  fetchImpl: typeof fetch
  store: AlertStore
  now: () => number
  config: AlertChannelConfig
}

export type AlertResult = {
  sent: boolean
  reason: 'sent' | 'deduped' | 'no_channel' | 'failed'
}

const DEFAULT_COOLDOWN_MINUTES = 360
const SEND_TIMEOUT_MS = 8_000
const MAX_TEXT_LENGTH = 1_800
const EMOJI: Record<AlertSeverity, string> = { info: 'ℹ️', warn: '⚠️', error: '🚨' }

export function readAlertConfig(env: Record<string, string | undefined> = process.env) {
  const clean = (value?: string) => value?.trim() || undefined
  const config: AlertChannelConfig = {
    webhookUrl: clean(env.ALERT_WEBHOOK_URL),
    telegramBotToken: clean(env.TELEGRAM_BOT_TOKEN),
    telegramChatId: clean(env.TELEGRAM_CHAT_ID),
    siteName: clean(env.NEXT_PUBLIC_BASE_URL),
  }
  return config
}

export function hasAlertChannel(config: AlertChannelConfig): boolean {
  return !!config.webhookUrl || (!!config.telegramBotToken && !!config.telegramChatId)
}

export function formatAlertText(input: AlertInput, siteName?: string): string {
  const lines = [`${EMOJI[input.severity]} ${input.title}`]
  for (const detail of input.details ?? []) lines.push(`- ${detail}`)
  if (siteName) lines.push(siteName)
  return redactSecrets(lines.join('\n')).slice(0, MAX_TEXT_LENGTH)
}

async function postJson(fetchImpl: typeof fetch, url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    // 不記錄例外內容：訊息裡可能含 webhook 網址或 bot token。
    return false
  }
}

function createCronLogStore(): AlertStore {
  return {
    async lastSentAt(key) {
      const { createServiceClient } = await import('@/lib/supabase')
      const { data, error } = await createServiceClient()
        .from('cron_logs')
        .select('created_at')
        .eq('job_name', 'alert')
        .eq('metadata->>key', key)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data?.created_at ? new Date(data.created_at).getTime() : null
    },
    async markSent(key, meta) {
      const { createServiceClient } = await import('@/lib/supabase')
      const { error } = await createServiceClient()
        .from('cron_logs')
        .insert({ job_name: 'alert', status: 'success', metadata: { key, ...meta } })
      if (error) throw new Error(error.message)
    },
  }
}

export async function sendAlert(
  input: AlertInput,
  overrides: Partial<AlertDeps> = {}
): Promise<AlertResult> {
  try {
    const deps: AlertDeps = {
      fetchImpl: fetch,
      store: createCronLogStore(),
      now: Date.now,
      config: readAlertConfig(),
      ...overrides,
    }
    const { config } = deps

    if (!hasAlertChannel(config)) {
      // 沒有任何管道時至少留下 error 級 log，Vercel 的 log 頁面找得到。
      logger.error('alert.no_channel', undefined, { key: input.key, title: input.title })
      return { sent: false, reason: 'no_channel' }
    }

    const cooldownMs = (input.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES) * 60_000
    try {
      const last = await deps.store.lastSentAt(input.key)
      if (last !== null && deps.now() - last < cooldownMs) {
        return { sent: false, reason: 'deduped' }
      }
    } catch (error) {
      // 查不到冷卻紀錄時寧可多送一次，也不要因此漏掉告警。
      logger.warn('alert.dedupe_lookup_fail', { error: getErrorMessage(error) })
    }

    const text = formatAlertText(input, config.siteName)
    const deliveries: Array<Promise<boolean>> = []
    if (config.webhookUrl) {
      deliveries.push(postJson(deps.fetchImpl, config.webhookUrl, { text, content: text }))
    }
    if (config.telegramBotToken && config.telegramChatId) {
      deliveries.push(
        postJson(
          deps.fetchImpl,
          `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
          { chat_id: config.telegramChatId, text }
        )
      )
    }

    const results = await Promise.all(deliveries)
    if (!results.some(Boolean)) {
      logger.error('alert.send_failed', undefined, { key: input.key, channels: results.length })
      return { sent: false, reason: 'failed' }
    }

    try {
      await deps.store.markSent(input.key, { severity: input.severity, title: input.title })
    } catch (error) {
      logger.warn('alert.mark_sent_fail', { error: getErrorMessage(error) })
    }
    return { sent: true, reason: 'sent' }
  } catch (error) {
    logger.error('alert.unexpected_fail', error, { key: input.key })
    return { sent: false, reason: 'failed' }
  }
}
