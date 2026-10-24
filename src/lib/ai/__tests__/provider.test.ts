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
import { resetProviderHealth } from '../provider-health'
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

// provider-health 的冷卻狀態存在模組記憶體裡，每個測試之間要清掉，避免互相影響。
afterEach(() => resetProviderHealth())

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

describe('generateWithFallback 與 provider 健康狀態', () => {
  const input = { sources: [], systemPrompt: 's', styleGuide: 'g' }
  const output = {
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
  const billingError = () => Object.assign(new Error('402 Payment Required'), { status: 402 })

  afterEach(() => jest.restoreAllMocks())

  it('主要 provider 因額度失敗後，下一次呼叫直接先走備援，不再白打一次', async () => {
    const primary = {
      provider: 'gemini' as AIProvider,
      generate: jest.fn().mockRejectedValue(billingError()),
    }
    const fallback = {
      provider: 'claude' as AIProvider,
      generate: jest.fn().mockResolvedValue(output),
    }

    const first = await generateWithFallback(input, { primary, fallback })
    const second = await generateWithFallback(input, { primary, fallback })

    expect(first.usedProvider).toBe('claude')
    expect(second.usedProvider).toBe('claude')
    expect(primary.generate).toHaveBeenCalledTimes(1)
    expect(fallback.generate).toHaveBeenCalledTimes(2)
  })

  it('備援也失敗時，仍會把冷卻中的主要 provider 當最後手段再試', async () => {
    const primary = {
      provider: 'gemini' as AIProvider,
      generate: jest.fn().mockRejectedValue(billingError()),
    }
    const fallback = {
      provider: 'claude' as AIProvider,
      generate: jest.fn().mockRejectedValue(new Error('claude down')),
    }

    await expect(generateWithFallback(input, { primary, fallback })).rejects.toBeInstanceOf(
      AggregateError
    )
    await expect(generateWithFallback(input, { primary, fallback })).rejects.toBeInstanceOf(
      AggregateError
    )

    expect(primary.generate).toHaveBeenCalledTimes(2)
    expect(fallback.generate).toHaveBeenCalledTimes(2)
  })

  it('冷卻結束且額度補上後，主要 provider 會被優先使用並恢復', async () => {
    const now = jest.spyOn(Date, 'now')
    now.mockReturnValue(1_000_000)
    const primary = {
      provider: 'gemini' as AIProvider,
      generate: jest.fn().mockRejectedValueOnce(billingError()).mockResolvedValue(output),
    }
    const fallback = {
      provider: 'claude' as AIProvider,
      generate: jest.fn().mockResolvedValue(output),
    }

    const first = await generateWithFallback(input, { primary, fallback })
    expect(first.usedProvider).toBe('claude')

    now.mockReturnValue(1_000_000 + 11 * 60_000)
    const later = await generateWithFallback(input, { primary, fallback })
    expect(later.usedProvider).toBe('gemini')
    expect(primary.generate).toHaveBeenCalledTimes(2)
  })

  it('一般錯誤不會觸發冷卻，下一次仍先試主要 provider', async () => {
    const primary = {
      provider: 'gemini' as AIProvider,
      generate: jest.fn().mockRejectedValue(new Error('Invalid JSON from Gemini: x')),
    }
    const fallback = {
      provider: 'claude' as AIProvider,
      generate: jest.fn().mockResolvedValue(output),
    }

    await generateWithFallback(input, { primary, fallback })
    await generateWithFallback(input, { primary, fallback })

    expect(primary.generate).toHaveBeenCalledTimes(2)
  })
})
