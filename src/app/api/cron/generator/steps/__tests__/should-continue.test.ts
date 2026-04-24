import { shouldContinueProcessing } from '../should-continue'
import { TIMEOUT_CONFIG } from '../config'

describe('shouldContinueProcessing', () => {
  const startTime = 1_000_000

  it('達到每輪硬上限 → 停，reason=article_limit', () => {
    const r = shouldContinueProcessing({
      processedCount: TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN,
      startTime,
      now: startTime + 10_000,
    })
    expect(r.shouldContinue).toBe(false)
    expect(r.reason).toBe('article_limit')
  })

  it('未達目標 + 時間充裕 → 繼續', () => {
    const r = shouldContinueProcessing({
      processedCount: TIMEOUT_CONFIG.TARGET_ARTICLES - 5,
      startTime,
      now: startTime + 10_000, // 剛開始不久，時間充裕
    })
    expect(r.shouldContinue).toBe(true)
  })

  it('未達目標但時間不夠 → 停，reason=time_insufficient_before_target', () => {
    const r = shouldContinueProcessing({
      processedCount: TIMEOUT_CONFIG.TARGET_ARTICLES - 5,
      startTime,
      now: startTime + (TIMEOUT_CONFIG.MAX_DURATION_MS - 1_000),
    })
    expect(r.shouldContinue).toBe(false)
    expect(r.reason).toBe('time_insufficient_before_target')
  })

  it('已達目標 + 時間充裕 → 繼續多做', () => {
    const r = shouldContinueProcessing({
      processedCount: TIMEOUT_CONFIG.TARGET_ARTICLES + 1,
      startTime,
      now: startTime + 10_000,
    })
    expect(r.shouldContinue).toBe(true)
  })

  it('已達目標但時間緊 → 停，reason=time_limit_after_target', () => {
    const r = shouldContinueProcessing({
      processedCount: TIMEOUT_CONFIG.TARGET_ARTICLES + 1,
      startTime,
      now: startTime + (TIMEOUT_CONFIG.MAX_DURATION_MS - 1_000),
    })
    expect(r.shouldContinue).toBe(false)
    expect(r.reason).toBe('time_limit_after_target')
  })
})
