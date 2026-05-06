/**
 * @jest-environment node
 */
import {
  makeGenerator,
  generateWithFallback,
  makeModerator,
  moderateContent,
  makeTextGenerator,
  generateText,
} from '../provider'
import type {
  ArticleGenerator,
  AIProvider,
  ContentModerator,
  ModerationResult,
  TextGenerator,
} from '../provider'

// Mock underlying provider implementations, because we only want to exercise
// the abstraction layer (factory + fallback) — not the real AI SDKs.
jest.mock('../claude', () => ({
  generateArticleWithClaude: jest.fn(),
  moderateComment: jest.fn(),
  generateText: jest.fn(),
}))
jest.mock('../gemini', () => ({
  generateArticleWithGemini: jest.fn(),
  moderateCommentWithGemini: jest.fn(),
  generateTextWithGemini: jest.fn(),
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

  // ---- pre-filter 整合 ----
  it('SKIPS LLM call when pre-filter decides "pass" (e.g. trivial short)', async () => {
    const primary = fakeModerator('gemini', 'ok', blockResult)
    const fallback = fakeModerator('claude', 'ok')
    const res = await moderateContent('好', { primary, fallback })
    expect(res).toEqual({ passed: true, confidence: 100, flags: [] })
    expect(primary.moderate).not.toHaveBeenCalled()
    expect(fallback.moderate).not.toHaveBeenCalled()
  })

  it('SKIPS LLM call when pre-filter decides "block" (e.g. LINE solicit)', async () => {
    const primary = fakeModerator('gemini', 'ok', passResult)
    const fallback = fakeModerator('claude', 'ok')
    const res = await moderateContent('快加 LINE: deal_2026 賺爆', { primary, fallback })
    expect(res.passed).toBe(false)
    expect(res.confidence).toBe(100)
    expect(res.flags[0]).toMatch(/^pre-filter:/)
    expect(primary.moderate).not.toHaveBeenCalled()
    expect(fallback.moderate).not.toHaveBeenCalled()
  })

  it('CALLS LLM when pre-filter defers (normal car comment)', async () => {
    const primary = fakeModerator('gemini', 'ok', passResult)
    const fallback = fakeModerator('claude', 'ok')
    const res = await moderateContent('這台 Tesla 真的超讚', { primary, fallback })
    expect(res).toEqual(passResult)
    expect(primary.moderate).toHaveBeenCalledTimes(1)
  })
})

describe('makeTextGenerator', () => {
  it('returns a Claude text generator when provider=claude', () => {
    const t = makeTextGenerator('claude')
    expect(t.provider).toBe('claude')
  })

  it('returns a Gemini text generator when provider=gemini', () => {
    const t = makeTextGenerator('gemini')
    expect(t.provider).toBe('gemini')
  })
})

describe('generateText', () => {
  function fakeTextGenerator(
    provider: AIProvider,
    behavior: 'ok' | 'fail',
    output = 'generated text'
  ): TextGenerator {
    return {
      provider,
      generate: jest.fn().mockImplementation(() => {
        if (behavior === 'fail') return Promise.reject(new Error(`${provider} text failure`))
        return Promise.resolve(output)
      }),
    }
  }

  it('returns primary text when primary succeeds', async () => {
    const primary = fakeTextGenerator('gemini', 'ok', 'gemini result')
    const fallback = fakeTextGenerator('claude', 'ok', 'claude result')
    const res = await generateText('prompt', { primary, fallback })
    expect(res).toBe('gemini result')
    expect(primary.generate).toHaveBeenCalledTimes(1)
    expect(fallback.generate).not.toHaveBeenCalled()
  })

  it('falls back to claude when gemini fails', async () => {
    const primary = fakeTextGenerator('gemini', 'fail')
    const fallback = fakeTextGenerator('claude', 'ok', 'claude rescue')
    const res = await generateText('prompt', { primary, fallback })
    expect(res).toBe('claude rescue')
    expect(fallback.generate).toHaveBeenCalledTimes(1)
  })

  it('throws AggregateError when both providers fail', async () => {
    const primary = fakeTextGenerator('gemini', 'fail')
    const fallback = fakeTextGenerator('claude', 'fail')
    let thrown: unknown
    try {
      await generateText('prompt', { primary, fallback })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(AggregateError)
    const agg = thrown as AggregateError
    expect(agg.errors).toHaveLength(2)
    expect((agg.errors[0] as Error).message).toBe('gemini text failure')
    expect((agg.errors[1] as Error).message).toBe('claude text failure')
  })

  it('passes maxTokens and temperature to the underlying generator', async () => {
    const primary = fakeTextGenerator('gemini', 'ok')
    const fallback = fakeTextGenerator('claude', 'ok')
    await generateText('prompt', { primary, fallback, maxTokens: 500, temperature: 0.3 })
    expect(primary.generate).toHaveBeenCalledWith('prompt', { maxTokens: 500, temperature: 0.3 })
  })
})
