import Anthropic from '@anthropic-ai/sdk'
import { getErrorMessage } from '@/lib/utils/error'

let client: Anthropic | null = null
let cachedModel: string | null = null
let lastModelCheck: number = 0
const MODEL_CACHE_TTL = 60 * 60 * 1000 // 1小時

function getAnthropic() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })
  }
  return client
}

/**
 * 獲取可用的 Claude 模型
 * 優先選擇最新的 Sonnet 模型
 */
async function getAvailableClaudeModel(): Promise<string | null> {
  // 檢查緩存
  if (cachedModel && Date.now() - lastModelCheck < MODEL_CACHE_TTL) {
    return cachedModel
  }

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.models.list({ limit: 100 })

    // 優先選擇最新的 Sonnet 模型（任何版本）
    const sonnetModels = response.data
      .filter(model => model.id.includes('sonnet'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (sonnetModels.length > 0) {
      cachedModel = sonnetModels[0].id
      lastModelCheck = Date.now()
      console.log(`✓ Using Claude model: ${cachedModel} (${sonnetModels[0].display_name})`)
      return cachedModel
    }

    // 如果連 Sonnet 3.5 都沒有，選擇任何可用的模型
    if (response.data.length > 0) {
      cachedModel = response.data[0].id
      lastModelCheck = Date.now()
      console.log(`⚠ Using fallback Claude model: ${cachedModel} (${response.data[0].display_name})`)
      return cachedModel
    }

    console.error('✗ No Claude models available')
    return null
  } catch (error) {
    console.error('✗ Failed to fetch Claude models:', error)
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

${input.sources.map((s, i) => `
**來源 ${i + 1}**
標題：${s.title}
URL：${s.url}
內容：
${s.content.slice(0, 2000)}...
`).join('\n---\n')}

---

### 輸出格式（JSON）

請嚴格按照以下JSON格式輸出，不要添加任何markdown代碼塊標記：

{
  "title_zh": "15-25字的標題",
  "slug_en": "url-friendly-english-slug",
  "content_zh": "完整正文（使用markdown格式）",
  "confidence": 85,
  "quality_checks": {
    "has_data": true,
    "has_sources": true,
    "has_banned_words": false,
    "has_unverified": false,
    "structure_valid": true
  },
  "reasoning": "簡要說明為什麼這些來源可以聚合",
  "brands": ["Tesla", "BMW"],
  "car_models": ["Model 3", "X5"],
  "categories": ["新車", "產業"],
  "tags": ["電動車", "自動駕駛", "新能源", "性能測試"]
}

**標籤提取說明**：
- brands: 提取文章的**主要品牌**（最多3個，英文）。只包含內容主要討論的品牌，不要列出只是順帶提及的品牌。
- car_models: 提取具體車型名稱
- categories: 從以下選擇1-2個最符合的分類，按以下標準嚴格判斷：
  * 新車：新車型發表、上市資訊、車款改款（必須有具體新車型或改款資訊）
  * 評測：試駕報告、性能測試、車輛比較（必須有實際測試內容）
  * 電動車：電動車相關新聞、電池技術、充電設施（主要討論電動車議題）
  * 產業：車企財報、併購重組、股價薪酬、企業策略（企業經營層面）
  * 市場：銷售數據、市佔率、排行榜、消費趨勢（市場消費端數據）
  * 科技：自動駕駛、車聯網、AI應用、創新技術（前沿技術為主）
  * 政策：法規變更、補貼政策、環保標準、稅制調整（政府政策法規）
  * 安全：安全測試、召回公告、事故分析、碰撞評級（安全與召回）
  * 賽車：賽事報導、車隊動態、賽車運動（必須與競速賽事相關）

  ⚠️ 關鍵判斷標準：
  - 企業經營/股價/薪酬 → 「產業」；銷售數據/市佔率 → 「市場」
  - 補貼/法規/標準 → 「政策」；召回/碰撞測試 → 「安全」
  - 如果同時涉及多個分類，選擇最主要的1-2個
- tags: 3-5個關鍵詞標籤（繁體中文）

開始撰寫：
`

  // 策略1: 嘗試使用 Claude
  const claudeModel = await getAvailableClaudeModel()

  if (claudeModel) {
    try {
      console.log(`→ Attempting to generate article with Claude (${claudeModel})...`)
      const anthropic = getAnthropic()

      const message = await anthropic.messages.create({
        model: claudeModel,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : ''

      // 清理可能的markdown代码块
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      // Parse JSON with error handling
      let result
      try {
        result = JSON.parse(jsonText)
      } catch (parseError) {
        console.error('Failed to parse Claude response JSON:', jsonText.slice(0, 500))
        throw new Error(`Invalid JSON from Claude: ${(parseError as Error).message}`)
      }

      console.log('✓ Article generated successfully with Claude')
      return result
    } catch (error) {
      console.error(`✗ Claude generation failed: ${getErrorMessage(error)}`)
      console.log('→ Falling back to OpenAI GPT-4o...')
    }
  } else {
    console.log('→ No Claude models available, using OpenAI GPT-4o...')
  }

  // 策略2: 降級到 OpenAI GPT-4o
  try {
    const OpenAI = require('openai').default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.7
    })

    const responseText = completion.choices[0]?.message?.content || ''

    // 清理可能的markdown代码块
    const jsonText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(jsonText)
    console.log('✓ Article generated successfully with OpenAI GPT-4o')
    return result
  } catch (error) {
    console.error('✗ OpenAI generation also failed:', error)
    throw new Error('Failed to generate article with both Claude and OpenAI')
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
  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 256,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const responseText = message.content[0].type === 'text'
    ? message.content[0].text
    : ''

  const jsonText = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return JSON.parse(jsonText)
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
  const message = await anthropic.messages.create({
    model: claudeModel,
    max_tokens: options?.maxTokens || 1024,
    temperature: options?.temperature || 0.7,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
