/**
 * @jest-environment node
 */
import { classifyAIError, isProviderUnavailable, needsHumanAction } from '../errors'

function httpError(status: number, message: string, code?: string): Error {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) })
}

describe('classifyAIError', () => {
  it('Gemini 預付額度用完（402）→ billing', () => {
    const err = new Error(
      '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [402 Payment Required] prepayment credits depleted'
    )
    const result = classifyAIError(err)
    expect(result.kind).toBe('billing')
    expect(result.status).toBe(402)
  })

  it('自己用 fetch 丟出的 embedding 錯誤，從訊息裡解析 402', () => {
    const result = classifyAIError(new Error('Gemini embedding API error 402: {"error":"x"}'))
    expect(result.kind).toBe('billing')
    expect(result.status).toBe(402)
  })

  it('OpenAI 429 insufficient_quota → billing，而不是一般限流', () => {
    const err = httpError(429, '429 You exceeded your current quota', 'insufficient_quota')
    expect(classifyAIError(err).kind).toBe('billing')
  })

  it('一般 429 → rate_limit', () => {
    expect(classifyAIError(httpError(429, 'Too many requests')).kind).toBe('rate_limit')
  })

  it('Anthropic 餘額不足（400）→ billing', () => {
    const err = httpError(400, 'Your credit balance is too low to access the Anthropic API.')
    expect(classifyAIError(err).kind).toBe('billing')
  })

  it('Anthropic 拒絕 temperature（400）→ bad_request，不是額度問題', () => {
    const err = httpError(400, '`temperature` is deprecated for this model')
    expect(classifyAIError(err).kind).toBe('bad_request')
  })

  it('401 與 403 → auth', () => {
    expect(classifyAIError(httpError(401, 'invalid x-api-key')).kind).toBe('auth')
    expect(classifyAIError(httpError(403, 'Forbidden')).kind).toBe('auth')
  })

  it('Gemini API key not valid（400）→ auth', () => {
    expect(
      classifyAIError(httpError(400, 'API key not valid. Please pass a valid API key.')).kind
    ).toBe('auth')
  })

  it('5xx 與 overloaded → server', () => {
    expect(classifyAIError(httpError(503, 'Service Unavailable')).kind).toBe('server')
    expect(classifyAIError(httpError(529, 'Overloaded')).kind).toBe('server')
  })

  it('連線逾時 → network', () => {
    expect(classifyAIError(new Error('fetch failed')).kind).toBe('network')
    expect(classifyAIError(Object.assign(new Error('boom'), { code: 'ECONNRESET' })).kind).toBe(
      'network'
    )
  })

  it('壞 JSON → parse', () => {
    expect(classifyAIError(new Error('Invalid JSON from Gemini: Unexpected token')).kind).toBe(
      'parse'
    )
    expect(classifyAIError(new SyntaxError('Unexpected end of JSON input')).kind).toBe('parse')
  })

  it('沒有線索的錯誤 → unknown', () => {
    expect(classifyAIError(new Error('something odd')).kind).toBe('unknown')
    expect(classifyAIError('plain string').kind).toBe('unknown')
  })

  it('AggregateError 取最嚴重的一個，並合併訊息', () => {
    const agg = new AggregateError(
      [httpError(402, 'payment required'), httpError(400, '`temperature` is deprecated')],
      'Both AI providers failed'
    )
    const result = classifyAIError(agg)
    expect(result.kind).toBe('billing')
    expect(result.message).toContain('payment required')
    expect(result.message).toContain('temperature')
  })

  it('錯誤訊息裡的金鑰會被遮蔽', () => {
    const key = 'AIza' + 'x'.repeat(35)
    const result = classifyAIError(new Error(`bad request ?key=${key}`))
    expect(result.message).not.toContain(key)
  })
})

describe('isProviderUnavailable / needsHumanAction', () => {
  it('billing 與 auth 需要人處理，且代表 provider 不可用', () => {
    for (const kind of ['billing', 'auth'] as const) {
      expect(isProviderUnavailable(kind)).toBe(true)
      expect(needsHumanAction(kind)).toBe(true)
    }
  })

  it('rate_limit、server、network 會自己恢復', () => {
    for (const kind of ['rate_limit', 'server', 'network'] as const) {
      expect(isProviderUnavailable(kind)).toBe(true)
      expect(needsHumanAction(kind)).toBe(false)
    }
  })

  it('bad_request、parse、unknown 不算 provider 不可用', () => {
    for (const kind of ['bad_request', 'parse', 'unknown'] as const) {
      expect(isProviderUnavailable(kind)).toBe(false)
    }
  })
})
