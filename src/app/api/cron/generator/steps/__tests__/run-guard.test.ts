/**
 * @jest-environment node
 */
import { RunGuard, decideRunStatus } from '../run-guard'

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

const billing = () => httpError(402, 'payment required')
const badJson = () => new Error('Invalid JSON from Gemini: x')

describe('RunGuard', () => {
  it('連續兩次服務不可用就中止，並記下原因', () => {
    const guard = new RunGuard()
    guard.recordFailure(billing())
    expect(guard.shouldAbort).toBe(false)
    guard.recordFailure(billing())
    expect(guard.shouldAbort).toBe(true)
    expect(guard.abortReason).toBe('ai_unavailable:billing')
  })

  it('中間成功一次就重新計算', () => {
    const guard = new RunGuard()
    guard.recordFailure(billing())
    guard.recordSuccess()
    guard.recordFailure(billing())
    expect(guard.shouldAbort).toBe(false)
  })

  it('內容層級的失敗（壞 JSON）要連續四次才中止', () => {
    const guard = new RunGuard()
    for (let i = 0; i < 3; i++) guard.recordFailure(badJson())
    expect(guard.shouldAbort).toBe(false)
    guard.recordFailure(badJson())
    expect(guard.shouldAbort).toBe(true)
    expect(guard.abortReason).toBe('repeated_failures:parse')
  })

  it('穿插內容失敗不會累積成「服務不可用」', () => {
    const guard = new RunGuard()
    guard.recordFailure(billing())
    guard.recordFailure(badJson())
    guard.recordFailure(billing())
    expect(guard.shouldAbort).toBe(false)
  })

  it('AggregateError 以最嚴重的一個為準', () => {
    const guard = new RunGuard()
    const agg = new AggregateError([billing(), badJson()], 'Both AI providers failed')
    expect(guard.recordFailure(agg)).toBe('billing')
  })

  it('保留第一個中止原因，之後的失敗不會覆蓋', () => {
    const guard = new RunGuard()
    guard.recordFailure(billing())
    guard.recordFailure(billing())
    guard.recordFailure(httpError(401, 'invalid x-api-key'))
    expect(guard.abortReason).toBe('ai_unavailable:billing')
  })

  it('summary 回傳各種失敗的次數', () => {
    const guard = new RunGuard()
    guard.recordSuccess()
    guard.recordFailure(badJson())
    guard.recordFailure(billing())
    expect(guard.summary()).toEqual({
      successes: 1,
      failures: 2,
      failuresByKind: { parse: 1, billing: 1 },
      abortReason: null,
    })
  })

  it('可自訂門檻', () => {
    const guard = new RunGuard({ maxConsecutiveUnavailable: 1, maxConsecutiveFailures: 10 })
    guard.recordFailure(billing())
    expect(guard.shouldAbort).toBe(true)
  })
})

describe('decideRunStatus', () => {
  it('有產出文章 → success，即使途中有失敗', () => {
    expect(decideRunStatus({ generated: 3, failures: 2, aborted: false })).toBe('success')
  })

  it('什麼都沒做也沒失敗（例如素材不足）→ success', () => {
    expect(decideRunStatus({ generated: 0, failures: 0, aborted: false })).toBe('success')
  })

  it('有失敗且完全沒有產出 → error', () => {
    expect(decideRunStatus({ generated: 0, failures: 1, aborted: false })).toBe('error')
  })

  it('提早中止 → error，即使已有產出', () => {
    expect(decideRunStatus({ generated: 2, failures: 2, aborted: true })).toBe('error')
  })
})
