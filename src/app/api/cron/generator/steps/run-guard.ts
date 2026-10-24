import { classifyAIError, isProviderUnavailable, type AIErrorKind } from '@/lib/ai/errors'

/**
 * 追蹤一輪生成中連續失敗的情形，決定要不要提早收工。
 *
 * 背景：AI 服務掛掉時，每個 cluster 都會花一整段時間嘗試然後失敗，
 * 十五個 cluster 下來白白佔滿整輪時間，還可能在中途付費生成後又丟棄。
 * 連續幾次都是「服務不可用」就代表不是這幾篇的問題，繼續下去沒有意義。
 */
export interface RunGuardOptions {
  /** 連續幾次「服務不可用」（額度、金鑰、限流、5xx、連線）就中止 */
  maxConsecutiveUnavailable: number
  /** 連續幾次任何失敗就中止 */
  maxConsecutiveFailures: number
}

export interface RunGuardSummary {
  successes: number
  failures: number
  failuresByKind: Partial<Record<AIErrorKind, number>>
  abortReason: string | null
}

const DEFAULT_OPTIONS: RunGuardOptions = {
  maxConsecutiveUnavailable: 2,
  maxConsecutiveFailures: 4,
}

export class RunGuard {
  private consecutiveUnavailable = 0
  private consecutiveFailures = 0
  private successes = 0
  private failures = 0
  private failuresByKind: Partial<Record<AIErrorKind, number>> = {}
  private abort: string | null = null

  constructor(private readonly options: RunGuardOptions = DEFAULT_OPTIONS) {}

  recordSuccess(): void {
    this.successes++
    this.consecutiveUnavailable = 0
    this.consecutiveFailures = 0
  }

  recordFailure(error: unknown): AIErrorKind {
    const { kind } = classifyAIError(error)
    this.failures++
    this.failuresByKind[kind] = (this.failuresByKind[kind] ?? 0) + 1
    this.consecutiveFailures++
    this.consecutiveUnavailable = isProviderUnavailable(kind) ? this.consecutiveUnavailable + 1 : 0

    if (this.abort === null) {
      if (this.consecutiveUnavailable >= this.options.maxConsecutiveUnavailable) {
        this.abort = `ai_unavailable:${kind}`
      } else if (this.consecutiveFailures >= this.options.maxConsecutiveFailures) {
        this.abort = `repeated_failures:${kind}`
      }
    }
    return kind
  }

  get shouldAbort(): boolean {
    return this.abort !== null
  }

  get abortReason(): string | null {
    return this.abort
  }

  summary(): RunGuardSummary {
    return {
      successes: this.successes,
      failures: this.failures,
      failuresByKind: { ...this.failuresByKind },
      abortReason: this.abort,
    }
  }
}

/**
 * cron_logs 的狀態。過去不論結果如何都記 success，導致整天沒產出文章時
 * 監控與人眼看到的都是「一切正常」。
 */
export function decideRunStatus(params: {
  generated: number
  failures: number
  aborted: boolean
}): 'success' | 'error' {
  if (params.aborted) return 'error'
  if (params.failures > 0 && params.generated === 0) return 'error'
  return 'success'
}
