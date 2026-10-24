/**
 * @jest-environment node
 */
import { evaluatePipelineHealth, getStaleHours, type PipelineHealthInput } from '../pipeline-health'

const NOW = Date.parse('2026-10-24T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

function input(overrides: Partial<PipelineHealthInput> = {}): PipelineHealthInput {
  return {
    nowMs: NOW,
    staleHours: 6,
    lastArticleAt: hoursAgo(1),
    generator: { status: 'success', at: hoursAgo(0.5) },
    scraper: { status: 'success', at: hoursAgo(0.5) },
    ...overrides,
  }
}

describe('evaluatePipelineHealth', () => {
  it('一切正常 → ok', () => {
    const health = evaluatePipelineHealth(input())
    expect(health.status).toBe('ok')
    expect(health.reasons).toEqual([])
    expect(health.hoursSinceLastArticle).toBe(1)
  })

  it('超過門檻沒有新文章 → stale，即使 cron 一直回報成功', () => {
    const health = evaluatePipelineHealth(input({ lastArticleAt: hoursAgo(23) }))
    expect(health.status).toBe('stale')
    expect(health.reasons).toContain('no_new_article_for_23h')
  })

  it('剛好達到門檻就算 stale', () => {
    expect(evaluatePipelineHealth(input({ lastArticleAt: hoursAgo(6) })).status).toBe('stale')
    expect(evaluatePipelineHealth(input({ lastArticleAt: hoursAgo(5.9) })).status).toBe('ok')
  })

  it('從來沒有文章 → stale', () => {
    const health = evaluatePipelineHealth(input({ lastArticleAt: null }))
    expect(health.status).toBe('stale')
    expect(health.hoursSinceLastArticle).toBeNull()
    expect(health.reasons).toContain('no_published_article')
  })

  it('還有新文章但上一輪 generator 失敗 → degraded', () => {
    const health = evaluatePipelineHealth(
      input({ generator: { status: 'error', at: hoursAgo(0.2) } })
    )
    expect(health.status).toBe('degraded')
    expect(health.reasons).toEqual(['generator_last_run_failed'])
  })

  it('scraper 超過三小時沒有紀錄 → degraded', () => {
    const health = evaluatePipelineHealth(
      input({ scraper: { status: 'success', at: hoursAgo(4) } })
    )
    expect(health.status).toBe('degraded')
    expect(health.reasons).toEqual(['scraper_silent_for_4h'])
  })

  it('完全沒有 cron 紀錄 → degraded', () => {
    const health = evaluatePipelineHealth(input({ generator: null, scraper: null }))
    expect(health.status).toBe('degraded')
    expect(health.reasons).toEqual(['generator_no_run_recorded', 'scraper_no_run_recorded'])
  })

  it('stale 的優先度高於 degraded', () => {
    const health = evaluatePipelineHealth(
      input({ lastArticleAt: hoursAgo(10), generator: { status: 'error', at: hoursAgo(0.1) } })
    )
    expect(health.status).toBe('stale')
    expect(health.reasons).toContain('generator_last_run_failed')
  })

  it('時間格式壞掉不會丟例外', () => {
    const health = evaluatePipelineHealth(input({ lastArticleAt: 'not-a-date' }))
    expect(health.status).toBe('stale')
  })
})

describe('getStaleHours', () => {
  it('預設 6 小時', () => {
    expect(getStaleHours({})).toBe(6)
  })

  it('可由環境變數覆寫', () => {
    expect(getStaleHours({ ALERT_STALE_HOURS: '12' })).toBe(12)
  })

  it('無效值回到預設', () => {
    expect(getStaleHours({ ALERT_STALE_HOURS: 'abc' })).toBe(6)
    expect(getStaleHours({ ALERT_STALE_HOURS: '-3' })).toBe(6)
    expect(getStaleHours({ ALERT_STALE_HOURS: '0' })).toBe(6)
  })
})
