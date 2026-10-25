import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'
import { ARTICLE_OUTPUT_SCHEMA_PROMPT, stripJSONCodeBlock } from './article-output-schema'
import {
  claudeThinkingParams,
  getClaudeTextOrThrow,
  isThinkingParamRejected,
  parseClaudeJson,
} from './claude-response'
import { recordAIUsage } from './usage-tracker'

let client: Anthropic | null = null
let cachedModel: string | null = null
let lastModelCheck: number = 0
const MODEL_CACHE_TTL = 60 * 60 * 1000 // 1小時
/** Claude 失敗時改用的 OpenAI 模型。請求與 ai_model 記錄共用同一個值，才不會對不上。 */
const OPENAI_ARTICLE_MODEL = 'gpt-4o'

function getAnthropic() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  }
  return client
}

/** 文章 JSON 的輸出上限。留足空間，避免模型預設的思考把額度吃光、JSON 寫到一半被截斷。 */
const CLAUDE_ARTICLE_MAX_TOKENS = 16000

/**
 * 送出請求。Sonnet 5.5 會附上關閉思考的參數；若 API 因為該參數回 400，
 * 就退回不帶它的請求，而不是讓整個 Claude 備援因此失效。
 */
async function createClaudeMessage(
  anthropic: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const extras = claudeThinkingParams(params.model)
  if (!('thinking' in extras)) return anthropic.messages.create(params)

  try {
    // 安裝的 SDK 版本的型別還不認得這個參數，但請求內容會原樣送出。
    return await anthropic.messages.create({
      ...params,
      ...extras,
    } as unknown as Anthropic.MessageCreateParamsNonStreaming)
  } catch (error) {
    if (!isThinkingParamRejected(error)) throw error
    logger.warn('ai.claude.thinking_param_rejected', {
      model: params.model,
      error: getErrorMessage(error),
    })
    return anthropic.messages.create(params)
  }
}

/**
 * 獲取可用的 Claude 模型
 * 優先選擇最新的 Sonnet 模型
 */
async function getAvailableClaudeModel(): Promise<string | null> {
  // 明確指定模型時直接使用，不再自動挑「最新的 Sonnet」。
  // 自動挑選會在 Anthropic 新增模型時悄悄換成參數不相容或價格不同的模型。
  const pinned = process.env.CLAUDE_MODEL?.trim()
  if (pinned) return pinned

  // 檢查緩存
  if (cachedModel && Date.now() - lastModelCheck < MODEL_CACHE_TTL) {
    return cachedModel
  }

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.models.list({ limit: 100 })

    // 優先選擇最新的 Sonnet 模型（任何版本）
    const sonnetModels = response.data
      .filter((model) => model.id.includes('sonnet'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (sonnetModels.length > 0) {
      cachedModel = sonnetModels[0].id
      lastModelCheck = Date.now()
      logger.info('ai.claude.model_check', {
        model: cachedModel,
        displayName: sonnetModels[0].display_name,
      })
      return cachedModel
    }

    // 如果連 Sonnet 3.5 都沒有，選擇任何可用的模型
    if (response.data.length > 0) {
      cachedModel = response.data[0].id
      lastModelCheck = Date.now()
      logger.warn('ai.claude.model_fallback', {
        model: cachedModel,
        displayName: response.data[0].display_name,
      })
      return cachedModel
    }

    logger.error('ai.claude.no_models_available')
    return null
  } catch (error) {
    logger.error('ai.claude.model_fetch_fail', error)
    return null
  }
}

export interface GenerateArticleInput {
  sources: Array<{
    title: string
    content: string
    url: string
  }>
  systemPrompt: string
  styleGuide: string
}

export interface GenerateArticleOutput {
  title_zh: string
  slug_en: string
  content_zh: string
  confidence: number
  quality_checks: {
    has_data: boolean
    has_sources: boolean
    has_banned_words: boolean
    has_unverified: boolean
    structure_valid: boolean
  }
  reasoning: string
  brands?: string[]
  car_models?: string[]
  categories?: string[]
  tags?: string[]
  /** 實際寫出這篇文章的模型 id。由各 provider 的實作在回傳前填入，不採用模型自己輸出的值。 */
  ai_model?: string
}

export async function generateArticleWithClaude(
  input: GenerateArticleInput
): Promise<GenerateArticleOutput> {
  const prompt = `
${input.systemPrompt}

${input.styleGuide}

---

## 任務

你將收到 ${input.sources.length} 篇關於相同主題的來源文章。
請按照上述風格指南，撰寫一篇綜合報導。

### 來源文章

${input.sources
  .map(
    (s, i) => `
**來源 ${i + 1}**
標題：${s.title}
URL：${s.url}
內容：
${s.content.slice(0, 2000)}...
`
  )
  .join('\n---\n')}

---

${ARTICLE_OUTPUT_SCHEMA_PROMPT}`

  // 策略1: 嘗試使用 Claude
  const claudeModel = await getAvailableClaudeModel()
  let claudeError: unknown

  if (claudeModel) {
    try {
      logger.info('ai.claude.generate_start', { model: claudeModel })
      const anthropic = getAnthropic()

      // 刻意不送 temperature：較新的 Claude 模型已不接受這個參數（回 400），
      // 而 getAvailableClaudeModel 會自動選到最新的 Sonnet，帶了就會每次都失敗。
      const message = await createClaudeMessage(anthropic, {
        model: claudeModel,
        max_tokens: CLAUDE_ARTICLE_MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      // 不論內容能不能用，token 都已經花了，先記錄用量。
      recordAIUsage({
        provider: 'claude',
        model: claudeModel,
        purpose: 'article_generation',
        inputTokens: message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens,
      })

      // 取出所有文字區塊：content[0] 可能是 thinking，過去只讀它而得到空字串。
      const responseText = getClaudeTextOrThrow(message)

      // Parse JSON with error handling
      let result: GenerateArticleOutput
      try {
        result = parseClaudeJson<GenerateArticleOutput>(responseText)
      } catch (parseError) {
        logger.error('ai.claude.parse_fail', parseError, {
          snippet: stripJSONCodeBlock(responseText).slice(0, 500),
          stopReason: message.stop_reason,
        })
        throw new Error(`Invalid JSON from Claude: ${(parseError as Error).message}`)
      }

      logger.info('ai.claude.generate_ok')
      return { ...result, ai_model: claudeModel }
    } catch (error) {
      claudeError = error
      logger.error('ai.claude.generate_fail', error)
      logger.info('ai.claude.fallback_to_openai')
    }
  } else {
    logger.info('ai.claude.no_model_fallback_openai')
  }

  // 策略2: 降級到 OpenAI GPT-4o
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: OPENAI_ARTICLE_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    })

    const responseText = completion.choices[0]?.message?.content || ''

    recordAIUsage({
      provider: 'openai',
      model: OPENAI_ARTICLE_MODEL,
      purpose: 'article_generation',
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    })

    const jsonText = stripJSONCodeBlock(responseText)
    const result = JSON.parse(jsonText)
    logger.info('ai.claude.openai_generate_ok')
    return { ...result, ai_model: OPENAI_ARTICLE_MODEL }
  } catch (error) {
    logger.error('ai.claude.openai_generate_fail', error)
    // 保留兩邊的原始錯誤，呼叫端才能分辨是額度、金鑰還是內容問題。
    throw new AggregateError(
      claudeError === undefined ? [error] : [claudeError, error],
      'Failed to generate article with both Claude and OpenAI'
    )
  }
}

export async function moderateComment(content: string): Promise<{
  passed: boolean
  confidence: number
  flags: string[]
}> {
  const prompt = `
你是一個評論審核系統。請判斷以下評論是否包含不當內容。

不當內容包括：
- 色情/性暗示內容
- 暴力/血腥內容
- 廣告/垃圾信息
- 政治敏感話題

評論內容：
"""
${content}
"""

請以JSON格式回答（不要添加markdown代碼塊）：
{
  "passed": true/false,
  "confidence": 0-100,
  "flags": ["色情", "暴力", "廣告", "政治"]
}

如果評論正常，flags應該是空數組 []。
只有在confidence > 95 且有明確違規內容時，才設置passed為false。
`

  const anthropic = getAnthropic()
  const moderationModel = 'claude-3-5-haiku-20241022'
  const message = await anthropic.messages.create({
    model: moderationModel,
    max_tokens: 256,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  recordAIUsage({
    provider: 'claude',
    model: moderationModel,
    purpose: 'moderation',
    inputTokens: message.usage?.input_tokens,
    outputTokens: message.usage?.output_tokens,
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  return JSON.parse(stripJSONCodeBlock(responseText))
}

/**
 * Simple text generation function for general purposes
 */
export async function generateText(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const claudeModel = await getAvailableClaudeModel()

  if (!claudeModel) {
    throw new Error('No Claude model available')
  }

  const anthropic = getAnthropic()
  const message = await createClaudeMessage(anthropic, {
    model: claudeModel,
    max_tokens: options?.maxTokens || 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  recordAIUsage({
    provider: 'claude',
    model: claudeModel,
    purpose: 'text_generation',
    inputTokens: message.usage?.input_tokens,
    outputTokens: message.usage?.output_tokens,
  })

  // 短文字可以接受被截斷的結果；空內容或被拒絕則丟錯，讓呼叫端走降級流程。
  return getClaudeTextOrThrow(message, { allowTruncated: true })
}
