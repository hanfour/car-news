import { classifyAIError, type AIErrorKind, type ClassifiedAIError } from './errors'

/**
 * 記住哪些 AI provider 剛剛失敗，讓同一輪裡接下來的呼叫先走還健康的那一個。
 *
 * 範圍：單一 server instance 的記憶體。serverless 實例重啟後會忘記，這是刻意的：
 * 它只用來避免「額度用完時每篇文章都先白打一次必定失敗的呼叫」，不是權威狀態。
 * 真正的健康與告警走資料庫與 sendAlert。
 */

/** 各種失敗之後暫時跳過該 provider 的時間。其他種類不冷卻。 */
const COOLDOWN_MS: Partial<Record<AIErrorKind, number>> = {
  billing: 10 * 60_000,
  auth: 10 * 60_000,
  rate_limit: 60_000,
  server: 60_000,
  network: 30_000,
}

interface Cooldown {
  until: number
  kind: AIErrorKind
}

export interface ProviderEvent {
  provider: string
  kind: AIErrorKind
  status?: number
  message: string
  at: number
}

const MAX_EVENTS = 50
const cooldowns = new Map<string, Cooldown>()
let events: ProviderEvent[] = []

export function recordProviderFailure(
  provider: string,
  error: unknown,
  now: number = Date.now()
): ClassifiedAIError {
  const classified = classifyAIError(error)
  const ms = COOLDOWN_MS[classified.kind]
  if (ms) cooldowns.set(provider, { until: now + ms, kind: classified.kind })
  events.push({
    provider,
    kind: classified.kind,
    status: classified.status,
    message: classified.message,
    at: now,
  })
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS)
  return classified
}

export function recordProviderSuccess(provider: string): void {
  cooldowns.delete(provider)
}

export function isCoolingDown(provider: string, now: number = Date.now()): boolean {
  const entry = cooldowns.get(provider)
  if (!entry) return false
  if (entry.until <= now) {
    cooldowns.delete(provider)
    return false
  }
  return true
}

/**
 * 健康的排前面，冷卻中的排最後。冷卻中的仍保留在清單裡，
 * 因此全部都在冷卻（或剛補完額度）時仍會被嘗試，不會被自己擋死。
 */
export function orderByHealth<T extends { provider: string }>(
  items: readonly T[],
  now: number = Date.now()
): T[] {
  const healthy = items.filter((item) => !isCoolingDown(item.provider, now))
  const cooling = items.filter((item) => isCoolingDown(item.provider, now))
  return [...healthy, ...cooling]
}

/** 取出並清空到目前為止累積的失敗事件，供一輪結束時組告警。 */
export function drainProviderEvents(): ProviderEvent[] {
  const drained = events
  events = []
  return drained
}

export function resetProviderHealth(): void {
  cooldowns.clear()
  events = []
}
