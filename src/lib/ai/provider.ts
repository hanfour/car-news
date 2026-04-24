import 'server-only'
import {
  generateArticleWithClaude,
  type GenerateArticleInput,
  type GenerateArticleOutput,
} from './claude'
import { generateArticleWithGemini } from './gemini'

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
export function getConfiguredGenerators(): { primary: ArticleGenerator; fallback: ArticleGenerator } {
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
  const { primary, fallback } = options?.primary && options.fallback
    ? { primary: options.primary, fallback: options.fallback }
    : getConfiguredGenerators()

  try {
    console.log(`→ Using ${primary.provider} for article generation`)
    const result = await primary.generate(input)
    return { result, usedProvider: primary.provider }
  } catch (primaryError) {
    console.error(`✗ ${primary.provider} failed, falling back to ${fallback.provider}:`, primaryError)
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
