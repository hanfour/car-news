import { getErrorMessage } from '@/lib/utils/error'
import { redactSecrets } from '@/lib/utils/redact'

/**
 * AI provider 錯誤分類。
 *
 * 目的：區分「這個 provider 現在不能用（額度用完、金鑰失效、暫時故障）」與
 * 「這一次的內容有問題（壞 JSON）」。前者要換 provider 並通知人，後者只需略過或重試。
 *
 * 純函式，不依賴任何 SDK 的錯誤類別，只讀常見欄位（status、code、message），
 * 因此 Google / Anthropic / OpenAI 與自己用 fetch 丟出的錯誤都能處理。
 */
export type AIErrorKind =
  | 'billing' // 額度用完或需要付款（402、insufficient_quota、credit balance too low）
  | 'auth' // 金鑰無效或沒有權限（401、403）
  | 'rate_limit' // 暫時限流（429）
  | 'server' // 供應商端暫時故障（5xx、overloaded）
  | 'network' // 連線逾時或中斷
  | 'bad_request' // 請求本身被拒絕（400 等），通常是程式或參數問題
  | 'parse' // 回傳內容不是合法 JSON
  | 'unknown'

export interface ClassifiedAIError {
  kind: AIErrorKind
  status?: number
  message: string
}

/** 從嚴重到輕微；AggregateError 取其中最嚴重的一個。 */
const SEVERITY_ORDER: readonly AIErrorKind[] = [
  'billing',
  'auth',
  'rate_limit',
  'server',
  'network',
  'bad_request',
  'parse',
  'unknown',
]

/** 這些種類代表「provider 現在不能用」，不是單篇內容的問題。 */
const PROVIDER_UNAVAILABLE: ReadonlySet<AIErrorKind> = new Set([
  'billing',
  'auth',
  'rate_limit',
  'server',
  'network',
])

/** 需要人處理才會好的種類（等一下不會自己恢復）。 */
const NEEDS_HUMAN: ReadonlySet<AIErrorKind> = new Set(['billing', 'auth'])

export function isProviderUnavailable(kind: AIErrorKind): boolean {
  return PROVIDER_UNAVAILABLE.has(kind)
}

export function needsHumanAction(kind: AIErrorKind): boolean {
  return NEEDS_HUMAN.has(kind)
}

const BILLING_PATTERN =
  /insufficient[_\s-]?quota|credit balance|payment required|out of credits?|credits? (?:have been |are |is )?(?:exhausted|depleted|used up)|prepa(?:y|id)|billing details|billing (?:account|is not|has not)|exceeded your current quota/i
const AUTH_PATTERN =
  /api key (?:not valid|is invalid|invalid)|invalid api key|invalid x-api-key|incorrect api key|permission[_\s]denied|unauthori[sz]ed|authentication[_\s](?:error|failed)/i
const SERVER_PATTERN =
  /overloaded|service unavailable|internal server error|bad gateway|gateway timeout/i
const NETWORK_PATTERN =
  /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|fetch failed|socket hang up|network error|timed? ?out|aborted/i

const STATUS_IN_MESSAGE: ReadonlyArray<RegExp> = [
  /\[(\d{3})\s[^\]]*\]/, // Google SDK：[402 Payment Required]
  /\b(?:error|status|http)\s*[:=]?\s*(\d{3})\b/i, // "API error 402: ..."
  /^\s*(\d{3})\b/, // Anthropic / OpenAI SDK：以狀態碼開頭
]

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const record = error as Record<string, unknown>
  for (const key of ['status', 'statusCode']) {
    const value = record[key]
    if (typeof value === 'number' && value >= 100 && value < 600) return value
  }
  const response = record.response as { status?: unknown } | undefined
  if (response && typeof response.status === 'number') return response.status
  return undefined
}

function statusFromMessage(message: string): number | undefined {
  for (const pattern of STATUS_IN_MESSAGE) {
    const match = pattern.exec(message)
    if (match) {
      const status = Number(match[1])
      if (status >= 100 && status < 600) return status
    }
  }
  return undefined
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return ''
}

function classifySingle(error: unknown): ClassifiedAIError {
  const message = redactSecrets(getErrorMessage(error)).slice(0, 400)
  const status = readStatus(error) ?? statusFromMessage(message)
  const haystack = `${readCode(error)} ${message}`

  if (status === 402 || BILLING_PATTERN.test(haystack)) return { kind: 'billing', status, message }
  if (status === 401 || status === 403 || AUTH_PATTERN.test(haystack)) {
    return { kind: 'auth', status, message }
  }
  if (status === 429) return { kind: 'rate_limit', status, message }
  if ((status !== undefined && status >= 500) || SERVER_PATTERN.test(haystack)) {
    return { kind: 'server', status, message }
  }
  if (NETWORK_PATTERN.test(haystack)) return { kind: 'network', status, message }
  if (error instanceof SyntaxError || /^Invalid JSON from/i.test(message)) {
    return { kind: 'parse', status, message }
  }
  if (status !== undefined && status >= 400) return { kind: 'bad_request', status, message }

  // 外層訊息沒有線索時，看看是不是包著真正的原因（new Error(msg, { cause })）。
  const cause = error instanceof Error ? error.cause : undefined
  if (cause !== undefined && cause !== error) {
    const inner = classifySingle(cause)
    if (inner.kind !== 'unknown') {
      return { ...inner, message: `${message} <- ${inner.message}`.slice(0, 400) }
    }
  }
  return { kind: 'unknown', status, message }
}

export function classifyAIError(error: unknown): ClassifiedAIError {
  if (error instanceof AggregateError) {
    const inner = error.errors.map(classifySingle)
    if (inner.length === 0) return classifySingle(error)
    const worst = [...inner].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.kind) - SEVERITY_ORDER.indexOf(b.kind)
    )[0]
    return {
      kind: worst.kind,
      status: worst.status,
      message: inner
        .map((e) => e.message)
        .join(' | ')
        .slice(0, 400),
    }
  }
  return classifySingle(error)
}
