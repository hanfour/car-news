/**
 * @jest-environment node
 */
import {
  buildRunAlerts,
  buildStaleAlert,
  checkPipelineStale,
  notifyRunResult,
  type RunAlertContext,
} from '../run-alerts'
import type { PipelineHealth } from '@/lib/pipeline-health'
import type { SupabaseClient } from '@supabase/supabase-js'

const healthyEmbedding = { mode: 'primary', provider: 'gemini' } as const

function ctx(overrides: Partial<RunAlertContext> = {}): RunAlertContext {
  return {
    embedding: healthyEmbedding,
    guard: { successes: 3, failures: 0, failuresByKind: {}, abortReason: null },
    providerEvents: [],
    generated: 3,
    ...overrides,
  }
}

const billingEvent = {
  provider: 'gemini',
  kind: 'billing' as const,
  status: 402,
  message: 'payment required',
  at: 1,
}

describe('buildRunAlerts', () => {
  it('一切正常時不發任何告警', () => {
    expect(buildRunAlerts(ctx())).toEqual([])
  })

  it('額度用盡但備援仍在產出 → warn，並說明已自動改用備援', () => {
    const alerts = buildRunAlerts(ctx({ providerEvents: [billingEvent], generated: 5 }))
    expect(alerts).toHaveLength(1)
    expect(alerts[0].key).toBe('provider:gemini:billing')
    expect(alerts[0].severity).toBe('warn')
    expect(alerts[0].title).toContain('Gemini')
    expect(alerts[0].details?.join('\n')).toContain('已自動改用備援')
  })

  it('額度用盡且本輪沒有任何產出 → error', () => {
    const alerts = buildRunAlerts(ctx({ providerEvents: [billingEvent], generated: 0 }))
    expect(alerts[0].severity).toBe('error')
    expect(alerts[0].details?.join('\n')).toContain('沒有產出任何文章')
  })

  it('同一個 provider 與種類只發一則', () => {
    const alerts = buildRunAlerts(
      ctx({ providerEvents: [billingEvent, { ...billingEvent, at: 2 }], generated: 1 })
    )
    expect(alerts).toHaveLength(1)
  })

  it('金鑰失效另外獨立一則', () => {
    const alerts = buildRunAlerts(
      ctx({
        providerEvents: [billingEvent, { ...billingEvent, provider: 'claude', kind: 'auth' }],
        generated: 1,
      })
    )
    expect(alerts.map((a) => a.key)).toEqual(['provider:gemini:billing', 'provider:claude:auth'])
  })

  it('暫時性的失敗（限流、5xx）不需要人處理，不發告警', () => {
    const alerts = buildRunAlerts(
      ctx({ providerEvents: [{ ...billingEvent, kind: 'server' }], generated: 2 })
    )
    expect(alerts).toEqual([])
  })

  it('向量嵌入進入降級模式 → warn', () => {
    const alerts = buildRunAlerts(
      ctx({
        embedding: {
          mode: 'fallback',
          provider: 'openai',
          primaryError: { kind: 'billing', status: 402, message: 'payment required' },
        },
      })
    )
    expect(alerts.map((a) => a.key)).toEqual(['embedding:fallback'])
    expect(alerts[0].severity).toBe('warn')
    expect(alerts[0].details?.join('\n')).toContain('降級模式')
  })

  it('向量嵌入完全不可用 → error，並說明有沒有備援', () => {
    const noBackup = buildRunAlerts(
      ctx({
        embedding: {
          mode: 'unavailable',
          provider: null,
          primaryError: { kind: 'billing', message: 'payment required' },
        },
        guard: null,
        generated: 0,
      })
    )
    expect(noBackup[0].key).toBe('embedding:unavailable')
    expect(noBackup[0].severity).toBe('error')
    expect(noBackup[0].details?.join('\n')).toContain('沒有可用的備援')
  })

  it('提早中止 → 本輪失敗的 error 告警', () => {
    const alerts = buildRunAlerts(
      ctx({
        generated: 0,
        guard: {
          successes: 0,
          failures: 2,
          failuresByKind: { billing: 2 },
          abortReason: 'ai_unavailable:billing',
        },
      })
    )
    const failed = alerts.find((a) => a.key === 'generator:run_failed')
    expect(failed?.severity).toBe('error')
    expect(failed?.details?.join('\n')).toContain('ai_unavailable:billing')
  })

  it('只失敗一次且沒產出、也沒有提早中止 → 不發告警，避免單篇內容問題洗版', () => {
    const alerts = buildRunAlerts(
      ctx({
        generated: 0,
        guard: { successes: 0, failures: 1, failuresByKind: { parse: 1 }, abortReason: null },
      })
    )
    expect(alerts.find((a) => a.key === 'generator:run_failed')).toBeUndefined()
  })

  it('沒有提早中止但連續兩次以上失敗且沒產出 → 發告警', () => {
    const alerts = buildRunAlerts(
      ctx({
        generated: 0,
        guard: { successes: 0, failures: 3, failuresByKind: { parse: 3 }, abortReason: null },
      })
    )
    expect(alerts.find((a) => a.key === 'generator:run_failed')?.severity).toBe('error')
  })

  it('有失敗但整體有產出 → 不發本輪失敗告警', () => {
    const alerts = buildRunAlerts(
      ctx({
        generated: 2,
        guard: { successes: 2, failures: 1, failuresByKind: { parse: 1 }, abortReason: null },
      })
    )
    expect(alerts.find((a) => a.key === 'generator:run_failed')).toBeUndefined()
  })
})

describe('buildStaleAlert', () => {
  const stale: PipelineHealth = {
    status: 'stale',
    hoursSinceLastArticle: 23.4,
    reasons: ['no_new_article_for_23h', 'generator_last_run_failed', 'scraper_silent_for_5h'],
  }

  it('非 stale 不發', () => {
    expect(buildStaleAlert({ status: 'ok', hoursSinceLastArticle: 1, reasons: [] }, 6)).toBeNull()
    expect(
      buildStaleAlert({ status: 'degraded', hoursSinceLastArticle: 1, reasons: ['x'] }, 6)
    ).toBeNull()
  })

  it('標題帶出已停多久，細節用白話描述原因', () => {
    const alert = buildStaleAlert(stale, 6)!
    expect(alert.key).toBe('pipeline:stale')
    expect(alert.severity).toBe('error')
    expect(alert.title).toBe('已 23 小時沒有新發布的文章')
    const details = alert.details!.join('\n')
    expect(details).toContain('門檻：6 小時')
    expect(details).toContain('上一輪文章生成失敗')
    expect(details).toContain('文章抓取排程已 5 小時沒有執行紀錄')
    expect(details).not.toContain('no_new_article')
  })

  it('完全沒有文章時標題不同', () => {
    const alert = buildStaleAlert(
      { status: 'stale', hoursSinceLastArticle: null, reasons: ['no_published_article'] },
      6
    )!
    expect(alert.title).toBe('網站還沒有任何已發布的文章')
  })
})

describe('checkPipelineStale', () => {
  const supabase = {} as SupabaseClient

  it('stale 時送出告警並回傳健康狀態', async () => {
    const health: PipelineHealth = { status: 'stale', hoursSinceLastArticle: 9, reasons: [] }
    const send = jest.fn().mockResolvedValue(undefined)
    const result = await checkPipelineStale(supabase, {
      load: jest.fn().mockResolvedValue(health),
      send,
      staleHours: 6,
    })
    expect(result).toBe(health)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ key: 'pipeline:stale' }))
  })

  it('正常時不送告警', async () => {
    const send = jest.fn()
    await checkPipelineStale(supabase, {
      load: jest.fn().mockResolvedValue({ status: 'ok', hoursSinceLastArticle: 1, reasons: [] }),
      send,
      staleHours: 6,
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('讀取失敗時不 throw，回傳 null', async () => {
    const result = await checkPipelineStale(supabase, {
      load: jest.fn().mockRejectedValue(new Error('db down')),
      send: jest.fn(),
      staleHours: 6,
    })
    expect(result).toBeNull()
  })
})

describe('notifyRunResult', () => {
  it('逐一送出組好的告警', async () => {
    const send = jest.fn().mockResolvedValue(undefined)
    await notifyRunResult(ctx({ providerEvents: [billingEvent], generated: 0 }), send)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('送出失敗不 throw', async () => {
    const send = jest.fn().mockRejectedValue(new Error('boom'))
    await expect(
      notifyRunResult(ctx({ providerEvents: [billingEvent], generated: 0 }), send)
    ).resolves.toBeUndefined()
  })
})
