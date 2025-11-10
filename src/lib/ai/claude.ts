import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getAnthropic() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })
  }
  return client
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
  "categories": ["新車", "評測", "行業", "數據"],
  "tags": ["電動車", "自動駕駛", "新能源", "性能測試"]
}

**標籤提取說明**：
- brands: 提取文章中提到的汽車品牌（英文）
- car_models: 提取具體車型名稱
- categories: 從以下選擇1-2個：新車、評測、行業、數據、技術
- tags: 3-5個關鍵詞標籤（繁體中文）

開始撰寫：
`

  const anthropic = getAnthropic()
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
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

  try {
    const result = JSON.parse(jsonText)
    return result
  } catch (error) {
    console.error('Failed to parse Claude response:', responseText)
    throw new Error('Invalid JSON response from Claude')
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
