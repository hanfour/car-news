import 'server-only'
import {
  generateArticleWithClaude,
  moderateComment as moderateWithClaude,
  generateText as generateTextWithClaude,
  type GenerateArticleInput,
  type GenerateArticleOutput,
} from './claude'
import {
  generateArticleWithGemini,
  moderateCommentWithGemini,
  generateTextWithGemini,
} from './gemini'
import { preFilterContent } from './pre-filter'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error'

export type AIProvider = 'claude' | 'gemini'
export type GeminiModel = 'flash' | 'pro'

/**
 * 統一的 Article Generator 介面。新增第 3 個 AI provider 時，
 * 只要實作這個介面並在 factory 加註冊即可，不必動 cron route。
 */
export interface ArticleGenerator {
  readonly provider: AIProvider
  generate(input: GenerateArticleInput): Promise<GenerateArticleOutput>
}

class ClaudeGenerator implements ArticleGenerator {
  readonly provider: AIProvider = 'claude'
  async generate(input: GenerateArticleInput): Promise<GenerateArticleOutput> {
    return generateArticleWithClaude(input)
  }
}

class GeminiGenerator implements ArticleGenerator {
  readonly provider: AIProvider = 'gemini'
  private readonly model: GeminiModel
  constructor(model: GeminiModel = 'flash') {
    this.model = model
  }
  async generate(input: GenerateArticleInput): Promise<GenerateArticleOutput> {
    return generateArticleWithGemini(input, this.model)
  }
}

export function makeGenerator(provider: AIProvider, geminiModel?: GeminiModel): ArticleGenerator {
  return provider === 'claude' ? new ClaudeGenerator() : new GeminiGenerator(geminiModel)
}

/**
 * 根據環境變數選擇主 provider 與備援 provider。
 * AI_PROVIDER 控制主要，失敗時自動切到另一個。
 */
export function getConfiguredGenerators(): {
  primary: ArticleGenerator
  fallback: ArticleGenerator
} {
  const primaryProvider = (process.env.AI_PROVIDER as AIProvider) || 'gemini'
  const geminiModel = (process.env.GEMINI_MODEL as GeminiModel) || 'flash'
  const primary = makeGenerator(primaryProvider, geminiModel)
  const fallbackProvider: AIProvider = primaryProvider === 'claude' ? 'gemini' : 'claude'
  const fallback = makeGenerator(fallbackProvider, geminiModel)
  return { primary, fallback }
}

/**
 * 呼叫主 provider，失敗自動切到 fallback；回傳結果與實際用到的 provider。
 */
export async function generateWithFallback(
  input: GenerateArticleInput,
  options?: { primary?: ArticleGenerator; fallback?: ArticleGenerator }
): Promise<{ result: GenerateArticleOutput; usedProvider: AIProvider }> {
  const { primary, fallback } =
    options?.primary && options.fallback
      ? { primary: options.primary, fallback: options.fallback }
      : getConfiguredGenerators()

  try {
    logger.info('ai.generate.primary_start', { provider: primary.provider })
    const result = await primary.generate(input)
    return { result, usedProvider: primary.provider }
  } catch (primaryError) {
    logger.warn('ai.generate.primary_fail', {
      provider: primary.provider,
      fallback: fallback.provider,
      error: getErrorMessage(primaryError),
    })
    try {
      const result = await fallback.generate(input)
      return { result, usedProvider: fallback.provider }
    } catch (fallbackError) {
      // 兩端都失敗時保留兩個錯誤方便 debug（否則 primary error 會被吞掉）
      throw new AggregateError(
        [primaryError, fallbackError],
        `Both AI providers failed: ${primary.provider} then ${fallback.provider}`
      )
    }
  }
}

// ============================================================================
// Content moderation 抽象 — 與 ArticleGenerator 同款 primary/fallback pattern
// ============================================================================

export interface ModerationResult {
  passed: boolean
  confidence: number
  flags: string[]
}

export interface ContentModerator {
  readonly provider: AIProvider
  moderate(content: string): Promise<ModerationResult>
}

class ClaudeModerator implements ContentModerator {
  readonly provider: AIProvider = 'claude'
  async moderate(content: string): Promise<ModerationResult> {
    return moderateWithClaude(content)
  }
}

class GeminiModerator implements ContentModerator {
  readonly provider: AIProvider = 'gemini'
  async moderate(content: string): Promise<ModerationResult> {
    return moderateCommentWithGemini(content)
  }
}

export function makeModerator(provider: AIProvider): ContentModerator {
  return provider === 'claude' ? new ClaudeModerator() : new GeminiModerator()
}

export function getConfiguredModerators(): {
  primary: ContentModerator
  fallback: ContentModerator
} {
  const primaryProvider = (process.env.AI_PROVIDER as AIProvider) || 'gemini'
  const primary = makeModerator(primaryProvider)
  const fallbackProvider: AIProvider = primaryProvider === 'claude' ? 'gemini' : 'claude'
  const fallback = makeModerator(fallbackProvider)
  return { primary, fallback }
}

// 兩端都失敗時的安全預設值：放行（false negative > false positive，
// 避免 LLM 服務中斷時阻擋所有使用者輸入）。
const SAFE_DEFAULT_MODERATION: ModerationResult = {
  passed: true,
  confidence: 0,
  flags: [],
}

/**
 * 審核內容並自動切換 provider。
 * - **本地 pre-filter** 命中明顯通過 / 明顯擋下 → 直接決定，連 LLM 都不打
 * - 主 provider 失敗 → 切到 fallback
 * - 兩端都失敗 → 回傳 SAFE_DEFAULT_MODERATION（passed: true）並 log error
 *
 * 永不 throw，呼叫端可直接信任回傳值。
 */
export async function moderateContent(
  content: string,
  options?: { primary?: ContentModerator; fallback?: ContentModerator }
): Promise<ModerationResult> {
  // 本地 regex 預判：明顯垃圾或無攻擊面，直接決定不打 LLM。
  // 規則設計上偏保守，不確定時 defer 給 LLM。
  const preFilter = preFilterContent(content)
  if (preFilter.decision === 'pass') {
    logger.info('ai.moderate.pre_filter_pass', { reason: preFilter.reason })
    return { passed: true, confidence: 100, flags: [] }
  }
  if (preFilter.decision === 'block') {
    logger.info('ai.moderate.pre_filter_block', { reason: preFilter.reason })
    return {
      passed: false,
      confidence: 100,
      flags: [`pre-filter:${preFilter.reason ?? 'unknown'}`],
    }
  }

  const { primary, fallback } =
    options?.primary && options.fallback
      ? { primary: options.primary, fallback: options.fallback }
      : getConfiguredModerators()

  try {
    return await primary.moderate(content)
  } catch (primaryError) {
    logger.warn('ai.moderate.primary_fail', {
      provider: primary.provider,
      fallback: fallback.provider,
      error: getErrorMessage(primaryError),
    })
    try {
      return await fallback.moderate(content)
    } catch (fallbackError) {
      logger.error('ai.moderate.both_fail', {
        primary: primary.provider,
        fallback: fallback.provider,
        primaryError: getErrorMessage(primaryError),
        fallbackError: getErrorMessage(fallbackError),
      })
      return SAFE_DEFAULT_MODERATION
    }
  }
}

// ============================================================================
// 通用文字生成抽象 — 同款 primary/fallback pattern
// 用於社群摘要等不需要結構化輸出的短文字場景
// ============================================================================

export interface TextGenerationOptions {
  maxTokens?: number
  temperature?: number
}

export interface TextGenerator {
  readonly provider: AIProvider
  generate(prompt: string, options?: TextGenerationOptions): Promise<string>
}

class ClaudeTextGenerator implements TextGenerator {
  readonly provider: AIProvider = 'claude'
  async generate(prompt: string, options?: TextGenerationOptions): Promise<string> {
    return generateTextWithClaude(prompt, options)
  }
}

class GeminiTextGenerator implements TextGenerator {
  readonly provider: AIProvider = 'gemini'
  private readonly model: GeminiModel
  constructor(model: GeminiModel = 'flash') {
    this.model = model
  }
  async generate(prompt: string, options?: TextGenerationOptions): Promise<string> {
    return generateTextWithGemini(prompt, { ...options, model: this.model })
  }
}

export function makeTextGenerator(provider: AIProvider, geminiModel?: GeminiModel): TextGenerator {
  return provider === 'claude' ? new ClaudeTextGenerator() : new GeminiTextGenerator(geminiModel)
}

export function getConfiguredTextGenerators(): {
  primary: TextGenerator
  fallback: TextGenerator
} {
  const primaryProvider = (process.env.AI_PROVIDER as AIProvider) || 'gemini'
  const geminiModel = (process.env.GEMINI_MODEL as GeminiModel) || 'flash'
  const primary = makeTextGenerator(primaryProvider, geminiModel)
  const fallbackProvider: AIProvider = primaryProvider === 'claude' ? 'gemini' : 'claude'
  const fallback = makeTextGenerator(fallbackProvider, geminiModel)
  return { primary, fallback }
}

/**
 * 通用文字生成（Gemini Flash 為主、Claude 為備援）。
 * - 主 provider 失敗 → 切到 fallback
 * - 兩端都失敗 → throw AggregateError（與 generateWithFallback 一致）
 *
 * 適用：社群摘要、簡短改寫等不需 JSON 結構的短文字輸出。
 * 呼叫端應自備 try/catch 與降級方案。
 */
export async function generateText(
  prompt: string,
  options?: TextGenerationOptions & {
    primary?: TextGenerator
    fallback?: TextGenerator
  }
): Promise<string> {
  const { primary, fallback } =
    options?.primary && options.fallback
      ? { primary: options.primary, fallback: options.fallback }
      : getConfiguredTextGenerators()

  const genOptions: TextGenerationOptions = {
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
  }

  try {
    return await primary.generate(prompt, genOptions)
  } catch (primaryError) {
    logger.warn('ai.text.primary_fail', {
      provider: primary.provider,
      fallback: fallback.provider,
      error: getErrorMessage(primaryError),
    })
    try {
      return await fallback.generate(prompt, genOptions)
    } catch (fallbackError) {
      throw new AggregateError(
        [primaryError, fallbackError],
        `Both AI text providers failed: ${primary.provider} then ${fallback.provider}`
      )
    }
  }
}
