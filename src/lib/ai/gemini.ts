import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GenerateArticleInput, GenerateArticleOutput } from './claude'
import { getErrorMessage } from '@/lib/utils/error'

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
        responseMimeType: 'application/json'
      }
    })

    console.log(`→ Generating article with Gemini ${model}...`)

    const result = await geminiModel.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Parse JSON
    let parsedResult: GenerateArticleOutput
    try {
      // Gemini 有時會包裝在 markdown 代碼塊中
      const jsonText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      parsedResult = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response JSON:', text.slice(0, 500))
      throw new Error(`Invalid JSON from Gemini: ${(parseError as Error).message}`)
    }

    console.log(`✓ Article generated successfully with Gemini ${model}`)
    return parsedResult

  } catch (error) {
    console.error(`✗ Gemini generation failed: ${getErrorMessage(error)}`)
    throw error
  }
}

/**
 * 使用 Gemini 進行評論審核
 * 使用 Flash 模型以節省成本
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

  try {
    const gemini = getGemini()
    const model = gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',  // 使用 Gemini 2.5 Flash
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
        responseMimeType: 'application/json'
      }
    })

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    const jsonText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    return JSON.parse(jsonText)
  } catch (error) {
    console.error('✗ Gemini moderation failed:', getErrorMessage(error))
    // 預設通過，避免 false positive
    return {
      passed: true,
      confidence: 0,
      flags: []
    }
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
    const modelName = (options?.model === 'pro')
      ? 'gemini-2.5-pro'  // 使用 Gemini 2.5 Pro
      : 'gemini-2.5-flash'  // 使用 Gemini 2.5 Flash

    const model = gemini.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens || 1024
      }
    })

    const result = await model.generateContent(prompt)
    const response = result.response
    return response.text()
  } catch (error) {
    console.error('✗ Gemini text generation failed:', getErrorMessage(error))
    throw error
  }
}
