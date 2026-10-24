/**
 * @jest-environment node
 */
import { resolveEmbeddingMode, type EmbeddingHealthDeps } from '../embedding-health'
import type { EmbeddingProvider } from '../embeddings'

// embedding-health 會 import embeddings（會載入 openai SDK 與 usage-tracker），這裡只測決策邏輯。
jest.mock('../embeddings', () => ({
  embedWithProvider: jest.fn(),
  getPrimaryEmbeddingProvider: jest.fn(() => 'gemini'),
  getFallbackEmbeddingProvider: jest.fn(() => 'openai'),
}))

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

function makeDeps(
  behavior: Partial<Record<EmbeddingProvider, Array<'ok' | Error>>>,
  fallback: EmbeddingProvider | null = 'openai'
): EmbeddingHealthDeps & { calls: EmbeddingProvider[] } {
  const queues: Record<string, Array<'ok' | Error>> = {
    gemini: [...(behavior.gemini ?? ['ok'])],
    openai: [...(behavior.openai ?? ['ok'])],
  }
  const calls: EmbeddingProvider[] = []
  return {
    calls,
    primary: 'gemini',
    fallback,
    sleep: async () => undefined,
    probe: async (provider) => {
      calls.push(provider)
      const next = queues[provider].length > 1 ? queues[provider].shift()! : queues[provider][0]
      if (next === 'ok') return [0]
      throw next
    },
  }
}

describe('resolveEmbeddingMode', () => {
  it('主要 provider 正常 → primary，不會去碰備援', async () => {
    const deps = makeDeps({})
    const status = await resolveEmbeddingMode(deps)
    expect(status).toEqual({ mode: 'primary', provider: 'gemini' })
    expect(deps.calls).toEqual(['gemini'])
  })

  it('主要額度用完、備援正常 → fallback，並帶出主要的錯誤種類', async () => {
    const deps = makeDeps({ gemini: [httpError(402, 'payment required')] })
    const status = await resolveEmbeddingMode(deps)
    expect(status.mode).toBe('fallback')
    expect(status.provider).toBe('openai')
    expect(status.primaryError?.kind).toBe('billing')
    // 額度問題不重試：主要只探測一次
    expect(deps.calls.filter((p) => p === 'gemini')).toHaveLength(1)
  })

  it('兩者都不可用 → unavailable，並保留兩邊的錯誤', async () => {
    const deps = makeDeps({
      gemini: [httpError(402, 'payment required')],
      openai: [httpError(401, 'invalid api key')],
    })
    const status = await resolveEmbeddingMode(deps)
    expect(status.mode).toBe('unavailable')
    expect(status.provider).toBeNull()
    expect(status.primaryError?.kind).toBe('billing')
    expect(status.fallbackError?.kind).toBe('auth')
  })

  it('沒有設定備援時，主要失敗就是 unavailable', async () => {
    const deps = makeDeps({ gemini: [httpError(402, 'payment required')] }, null)
    const status = await resolveEmbeddingMode(deps)
    expect(status.mode).toBe('unavailable')
    expect(status.fallbackError).toBeUndefined()
    expect(deps.calls).toEqual(['gemini'])
  })

  it('暫時性錯誤會重試一次，第二次成功就算 primary', async () => {
    const deps = makeDeps({ gemini: [httpError(503, 'Service Unavailable'), 'ok'] })
    const status = await resolveEmbeddingMode(deps)
    expect(status.mode).toBe('primary')
    expect(deps.calls).toEqual(['gemini', 'gemini'])
  })

  it('暫時性錯誤重試後仍失敗才切到備援', async () => {
    const deps = makeDeps({ gemini: [httpError(503, 'Service Unavailable')] })
    const status = await resolveEmbeddingMode(deps)
    expect(status.mode).toBe('fallback')
    expect(deps.calls.filter((p) => p === 'gemini')).toHaveLength(2)
  })
})
