import { TIMEOUT_CONFIG } from './config'

/**
 * 根據已處理數量和開始時間，決定 generator 是否應繼續處理下一批。
 * Pure function — 純邏輯，好測。
 *
 * 規則：
 *  1. 達到每輪硬上限 → 停
 *  2. 未達目標 → 只要還有估時空間就繼續
 *  3. 已達目標 → 時間充裕可再多做；時間緊就停
 */
export function shouldContinueProcessing(params: {
  processedCount: number
  startTime: number
  now?: number
}): { shouldContinue: boolean; reason?: string } {
  const now = params.now ?? Date.now()
  const elapsed = now - params.startTime
  const remaining = TIMEOUT_CONFIG.MAX_DURATION_MS - elapsed
  const minRequired = TIMEOUT_CONFIG.ESTIMATED_TIME_PER_ARTICLE + TIMEOUT_CONFIG.MIN_TIME_BUFFER

  if (params.processedCount >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN) {
    return { shouldContinue: false, reason: 'article_limit' }
  }

  if (params.processedCount < TIMEOUT_CONFIG.TARGET_ARTICLES) {
    if (remaining < minRequired) {
      return { shouldContinue: false, reason: 'time_insufficient_before_target' }
    }
    return { shouldContinue: true }
  }

  if (remaining < minRequired) {
    return { shouldContinue: false, reason: 'time_limit_after_target' }
  }

  return { shouldContinue: true }
}
