import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GenerateArticleInput, GenerateArticleOutput } from './claude'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'
import { ARTICLE_OUTPUT_SCHEMA_PROMPT, stripJSONCodeBlock } from './article-output-schema'

let genAI: GoogleGenerativeAI | null = null

function getGemini() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable is required')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

/**
 * 使用 Gemini 2.5 Flash 生成文章
 * 優點：
 * - 成本極低（$0.075/$0.30 per 1M tokens）
 * - 免費額度：每天 1500 requests
 * - 速度快
 * - 支援 1M context window
 */
export async function generateArticleWithGemini(
  input: GenerateArticleInput,
  model: 'flash' | 'pro' = 'flash'
): Promise<GenerateArticleOutput> {
  const prompt = `
${input.systemPrompt}

${input.styleGuide}

---

## 任務說明

你將收到 ${input.sources.length} 篇關於相同主題的來源文章。

⚠️ 重要提醒：你是「數據分析師」，不是「文章改寫者」。

### 步驟一：數據提取
從來源中提取以下客觀數據（這些數據不受著作權保護）：
- 價格：具體數字、漲跌幅度、各市場售價
- 規格：馬力、扭力、電池容量、續航里程、車身尺寸
- 日期：發布日期、上市時間、預購開放日
- 地區：適用市場、銷售區域

### 步驟二：以「中立分析師」口吻撰寫
- 禁止使用與來源相同的形容詞和句式
- 自行重新構思文章結構（不得沿用來源的段落順序）
- 加入「這對台灣消費者意味著什麼」的分析段落

### ⛔ 絕對禁止（違反將導致文章被退回）
**正文格式規則：**
- ❌ 正文開頭不得重複標題（不要用 ### 或 ## 重複 title_zh）
- ❌ 不得使用段落編號：「第一段：」「第二段：」
- ❌ 不得使用區塊標題：「### 導語」「### 背景分析」「### 總結」
- ❌ 不得使用任何 ###、##、** 格式的段落標題
- ✅ 正確做法：正文第一個字就是內容，直接撰寫連貫的敘述性文章，自然分段即可

### 步驟三：來源標註
- 在正文開頭用一句話說明資訊來源
- 文末提供原文連結供深度閱讀

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

  try {
    const gemini = getGemini()
    // 使用 Gemini 2.5 模型（最新穩定版本）
    const modelName = model === 'flash' ? 'gemini-2.5-flash' : 'gemini-2.5-pro'
    const geminiModel = gemini.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        // Gemini 2.5 Flash 支持最高 65536 output tokens
        // 中文文章 + JSON 結構 + metadata 需要較大空間，設為 16384 確保不被截斷
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    })

    logger.info('ai.gemini.generate_start', { model })

    const result = await geminiModel.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Parse JSON（Gemini 偶爾會包 markdown 代碼塊，集中由 helper 處理）
    let parsedResult: GenerateArticleOutput
    try {
      parsedResult = JSON.parse(stripJSONCodeBlock(text))
    } catch (parseError) {
      logger.error('ai.gemini.parse_fail', parseError, { snippet: text.slice(0, 500) })
      throw new Error(`Invalid JSON from Gemini: ${(parseError as Error).message}`)
    }

    logger.info('ai.gemini.generate_ok', { model })
    return parsedResult
  } catch (error) {
    logger.error('ai.gemini.generate_fail', error)
    throw error
  }
}

/**
 * 使用 Gemini 進行評論審核
 * 使用 Flash 模型以節省成本。
 *
 * 失敗時 throw — 由 provider.moderateContent() 負責 fallback 與安全預設值。
 */
export async function moderateCommentWithGemini(content: string): Promise<{
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

請以JSON格式回答：
{
  "passed": true/false,
  "confidence": 0-100,
  "flags": ["色情", "暴力", "廣告", "政治"]
}

如果評論正常，flags應該是空數組 []。
只有在confidence > 95 且有明確違規內容時，才設置passed為false。
`

  const gemini = getGemini()
  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
    },
  })

  const result = await model.generateContent(prompt)
  const jsonText = stripJSONCodeBlock(result.response.text())

  try {
    return JSON.parse(jsonText)
  } catch (parseError) {
    logger.error('ai.gemini.moderate_parse_fail', parseError, { snippet: jsonText.slice(0, 200) })
    throw new Error(`Invalid JSON from Gemini moderation: ${(parseError as Error).message}`)
  }
}

/**
 * 通用文字生成函數
 */
export async function generateTextWithGemini(
  prompt: string,
  options?: {
    maxTokens?: number
    temperature?: number
    model?: 'flash' | 'pro'
  }
): Promise<string> {
  try {
    const gemini = getGemini()
    const modelName =
      options?.model === 'pro'
        ? 'gemini-2.5-pro' // 使用 Gemini 2.5 Pro
        : 'gemini-2.5-flash' // 使用 Gemini 2.5 Flash

    const model = gemini.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens || 1024,
      },
    })

    const result = await model.generateContent(prompt)
    const response = result.response
    return response.text()
  } catch (error) {
    logger.error('ai.gemini.text_generate_fail', error)
    throw error
  }
}
