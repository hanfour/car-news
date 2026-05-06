/**
 * @jest-environment node
 */
import { makeGenerator, generateWithFallback, makeModerator, moderateContent } from '../provider'
import type { ArticleGenerator, AIProvider, ContentModerator, ModerationResult } from '../provider'

// Mock underlying provider implementations, because we only want to exercise
// the abstraction layer (factory + fallback) — not the real AI SDKs.
jest.mock('../claude', () => ({
  generateArticleWithClaude: jest.fn(),
  moderateComment: jest.fn(),
}))
jest.mock('../gemini', () => ({
  generateArticleWithGemini: jest.fn(),
  moderateCommentWithGemini: jest.fn(),
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

  it('throws AggregateError with both errors when both fail', async () => {
    const primary = fakeGenerator('gemini', 'fail')
    const fallback = fakeGenerator('claude', 'fail')
    let thrown: unknown
    try {
      await generateWithFallback(input, { primary, fallback })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(AggregateError)
    const agg = thrown as AggregateError
    expect(agg.errors).toHaveLength(2)
    expect((agg.errors[0] as Error).message).toBe('gemini failure')
    expect((agg.errors[1] as Error).message).toBe('claude failure')
  })
})

describe('makeModerator', () => {
  it('returns a Claude moderator when provider=claude', () => {
    const m = makeModerator('claude')
    expect(m.provider).toBe('claude')
  })

  it('returns a Gemini moderator when provider=gemini', () => {
    const m = makeModerator('gemini')
    expect(m.provider).toBe('gemini')
  })
})

describe('moderateContent', () => {
  const passResult: ModerationResult = { passed: true, confidence: 10, flags: [] }
  const blockResult: ModerationResult = { passed: false, confidence: 99, flags: ['廣告'] }

  function fakeModerator(
    provider: AIProvider,
    behavior: 'ok' | 'fail',
    result = passResult
  ): ContentModerator {
    return {
      provider,
      moderate: jest.fn().mockImplementation(() => {
        if (behavior === 'fail') return Promise.reject(new Error(`${provider} moderate failure`))
        return Promise.resolve(result)
      }),
    }
  }

  it('returns primary result when primary succeeds', async () => {
    const primary = fakeModerator('gemini', 'ok', blockResult)
    const fallback = fakeModerator('claude', 'ok', passResult)
    const res = await moderateContent('test', { primary, fallback })
    expect(res).toEqual(blockResult)
    expect(primary.moderate).toHaveBeenCalledTimes(1)
    expect(fallback.moderate).not.toHaveBeenCalled()
  })

  it('falls back to claude when gemini fails', async () => {
    const primary = fakeModerator('gemini', 'fail')
    const fallback = fakeModerator('claude', 'ok', blockResult)
    const res = await moderateContent('test', { primary, fallback })
    expect(res).toEqual(blockResult)
    expect(fallback.moderate).toHaveBeenCalledTimes(1)
  })

  it('returns SAFE_DEFAULT (passed:true) when both providers fail', async () => {
    // 安全預設：LLM 全掛時放行使用者輸入，避免阻擋正常留言
    const primary = fakeModerator('gemini', 'fail')
    const fallback = fakeModerator('claude', 'fail')
    const res = await moderateContent('test', { primary, fallback })
    expect(res).toEqual({ passed: true, confidence: 0, flags: [] })
  })
})
