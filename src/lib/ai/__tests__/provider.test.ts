/**
 * @jest-environment node
 */
import { makeGenerator, generateWithFallback } from '../provider'
import type { ArticleGenerator, AIProvider } from '../provider'

// Mock underlying provider implementations, because we only want to exercise
// the abstraction layer (factory + fallback) — not the real AI SDKs.
jest.mock('../claude', () => ({
  generateArticleWithClaude: jest.fn(),
}))
jest.mock('../gemini', () => ({
  generateArticleWithGemini: jest.fn(),
}))

describe('makeGenerator', () => {
  it('returns a ClaudeGenerator when provider=claude', () => {
    const g = makeGenerator('claude')
    expect(g.provider).toBe('claude')
  })

  it('returns a GeminiGenerator when provider=gemini', () => {
    const g = makeGenerator('gemini')
    expect(g.provider).toBe('gemini')
  })
})

describe('generateWithFallback', () => {
  const input = { sources: [], systemPrompt: 's', styleGuide: 'g' }
  const sampleOutput = {
    title_zh: '標題',
    content_zh: '內文',
    slug_en: 'slug',
    confidence: 0.9,
    quality_checks: {},
    reasoning: 'r',
    brands: [],
    car_models: [],
    categories: [],
    tags: [],
  }

  function fakeGenerator(provider: AIProvider, behavior: 'ok' | 'fail'): ArticleGenerator {
    return {
      provider,
      generate: jest.fn().mockImplementation(() => {
        if (behavior === 'fail') return Promise.reject(new Error(`${provider} failure`))
        return Promise.resolve(sampleOutput)
      }),
    }
  }

  it('returns primary result when primary succeeds', async () => {
    const primary = fakeGenerator('gemini', 'ok')
    const fallback = fakeGenerator('claude', 'ok')
    const res = await generateWithFallback(input, { primary, fallback })
    expect(res.usedProvider).toBe('gemini')
    expect(primary.generate).toHaveBeenCalledTimes(1)
    expect(fallback.generate).not.toHaveBeenCalled()
  })

  it('falls back when primary fails', async () => {
    const primary = fakeGenerator('gemini', 'fail')
    const fallback = fakeGenerator('claude', 'ok')
    const res = await generateWithFallback(input, { primary, fallback })
    expect(res.usedProvider).toBe('claude')
    expect(fallback.generate).toHaveBeenCalledTimes(1)
  })

  it('propagates fallback failure when both fail', async () => {
    const primary = fakeGenerator('gemini', 'fail')
    const fallback = fakeGenerator('claude', 'fail')
    await expect(generateWithFallback(input, { primary, fallback })).rejects.toThrow(
      'claude failure'
    )
  })
})
