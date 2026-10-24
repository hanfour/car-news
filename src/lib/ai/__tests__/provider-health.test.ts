/**
 * @jest-environment node
 */
import {
  drainProviderEvents,
  isCoolingDown,
  orderByHealth,
  recordProviderFailure,
  recordProviderSuccess,
  resetProviderHealth,
} from '../provider-health'

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

const MINUTE = 60_000

afterEach(() => resetProviderHealth())

describe('recordProviderFailure', () => {
  it('額度用完會讓 provider 冷卻 10 分鐘，之後自動解除', () => {
    const t0 = 1_000_000
    const result = recordProviderFailure('gemini', httpError(402, 'payment required'), t0)
    expect(result.kind).toBe('billing')
    expect(isCoolingDown('gemini', t0 + 9 * MINUTE)).toBe(true)
    expect(isCoolingDown('gemini', t0 + 10 * MINUTE)).toBe(false)
  })

  it('暫時性錯誤只冷卻一分鐘', () => {
    const t0 = 1_000_000
    recordProviderFailure('claude', httpError(503, 'Service Unavailable'), t0)
    expect(isCoolingDown('claude', t0 + 30_000)).toBe(true)
    expect(isCoolingDown('claude', t0 + MINUTE)).toBe(false)
  })

  it('內容層級的錯誤（壞 JSON、請求被拒）不冷卻', () => {
    const t0 = 1_000_000
    recordProviderFailure('gemini', new Error('Invalid JSON from Gemini: x'), t0)
    recordProviderFailure('claude', httpError(400, '`temperature` is deprecated'), t0)
    expect(isCoolingDown('gemini', t0 + 1)).toBe(false)
    expect(isCoolingDown('claude', t0 + 1)).toBe(false)
  })

  it('成功一次就清除冷卻', () => {
    const t0 = 1_000_000
    recordProviderFailure('gemini', httpError(402, 'payment required'), t0)
    recordProviderSuccess('gemini')
    expect(isCoolingDown('gemini', t0 + 1)).toBe(false)
  })
})

describe('orderByHealth', () => {
  const a = { provider: 'gemini' }
  const b = { provider: 'claude' }

  it('沒有人冷卻時維持原順序', () => {
    expect(orderByHealth([a, b])).toEqual([a, b])
  })

  it('冷卻中的排到最後，但仍保留在清單裡', () => {
    const t0 = 1_000_000
    recordProviderFailure('gemini', httpError(402, 'payment required'), t0)
    expect(orderByHealth([a, b], t0 + 1)).toEqual([b, a])
  })

  it('全部都冷卻時維持原順序，不會把任何一個排除', () => {
    const t0 = 1_000_000
    recordProviderFailure('gemini', httpError(402, 'payment required'), t0)
    recordProviderFailure('claude', httpError(402, 'payment required'), t0)
    expect(orderByHealth([a, b], t0 + 1)).toEqual([a, b])
  })
})

describe('drainProviderEvents', () => {
  it('取出累積的事件並清空', () => {
    recordProviderFailure('gemini', httpError(402, 'payment required'), 1)
    recordProviderFailure('claude', httpError(401, 'invalid x-api-key'), 2)
    const drained = drainProviderEvents()
    expect(drained.map((e) => [e.provider, e.kind])).toEqual([
      ['gemini', 'billing'],
      ['claude', 'auth'],
    ])
    expect(drainProviderEvents()).toEqual([])
  })

  it('最多保留最近 50 筆', () => {
    for (let i = 0; i < 80; i++) recordProviderFailure('gemini', new Error(`e${i}`), i)
    const drained = drainProviderEvents()
    expect(drained).toHaveLength(50)
    expect(drained[0].message).toBe('e30')
    expect(drained[49].message).toBe('e79')
  })
})
