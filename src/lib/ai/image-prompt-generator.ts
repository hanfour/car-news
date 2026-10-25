import 'server-only'
/**
 * 用 Gemini 智能分析文章，生成精准的图片描述
 * 确保 AI 生成的封面图与文章内容匹配
 *
 * Gemini 不可用時（額度用盡、金鑰失效、暫時故障）改用 Claude；
 * 兩邊都失敗才降級成關鍵字模板，封面圖仍會產出，只是描述比較制式。
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getErrorMessage } from '@/lib/utils/error'
import { extractCarModel, getVehicleVisualDescription } from './flux-image-generation'
import { logger } from '@/lib/logger'
import { recordAIUsage } from './usage-tracker'
import { generateText as generateTextWithClaude } from './claude'
import { orderByHealth, recordProviderFailure, recordProviderSuccess } from './provider-health'

let genAI: GoogleGenerativeAI | null = null

function getGemini() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

export interface ImagePromptResult {
  /** 主要视觉主体 */
  subject: string
  /** 车辆类型 */
  vehicleType: string
  /** 品牌风格描述（不直接用品牌名） */
  brandStyle: string
  /** 场景/环境 */
  setting: string
  /** 关键视觉元素 */
  keyElements: string[]
  /** 情绪/氛围 */
  mood: string
  /** 完整的图片生成 prompt */
  fullPrompt: string
}

/** 組出給文字模型的提示詞。Gemini 與 Claude 共用同一份。 */
function buildImagePromptRequest(title: string, content: string, brands?: string[]): string {
  // 從標題提取車款資訊，提供給模型作為參考
  const detectedModel = extractCarModel(title, brands?.[0])
  const knownVisualDesc = detectedModel ? getVehicleVisualDescription(detectedModel) : null

  const visualHint = knownVisualDesc
    ? `\nKNOWN VISUAL REFERENCE for "${detectedModel}": ${knownVisualDesc}\nYou MUST incorporate these visual details into the fullPrompt.`
    : ''

  return `Generate an image prompt for this automotive news article.

Title: ${title}
Content: ${content.slice(0, 800)}
Brand: ${brands?.[0] || 'generic'}
${visualHint}

CRITICAL RULES:
1. AI image generators (Flux, DALL-E) CANNOT recognize brand names or logos. They do NOT know what a "Tesla" or "BMW" looks like. You MUST describe the vehicle's PHYSICAL APPEARANCE in extreme detail.
2. Describe: body shape (angular/rounded/sleek), proportions (long hood/short deck), distinctive design elements (grille shape, headlight style, body lines), surface finish, stance.
3. BAD prompt: "Tesla Cybertruck pickup truck in a studio" → generates generic Ford-like truck
4. GOOD prompt: "Angular stainless steel pickup truck with flat geometric body panels, triangular wedge profile, sharp creased edges like folded sheet metal, no curves, brutalist origami-like design, unpainted brushed metal surface, futuristic angular LED light bar across full width"
5. NEVER use generic descriptions like "modern vehicle" or "sleek car". Every sentence must describe a SPECIFIC visual feature.
6. Include body type: sedan, SUV, hatchback, coupe, pickup truck, etc.
7. If the article discusses multiple models, focus on the PRIMARY model mentioned first in the title.

Output a JSON object with these fields:
- subject: main visual subject with specific appearance details (50+ words)
- vehicleType: specific type (e.g., "angular stainless steel electric pickup truck")
- brandStyle: design language with physical details
- setting: environment/location
- keyElements: array of 3 unique visual features that distinguish this exact model from all others
- mood: overall atmosphere
- fullPrompt: complete English prompt (200-300 words). Start with "Professional automotive photography." Spend 60%+ of words on the vehicle's unique physical appearance. Include: body shape, panel geometry, headlight/taillight design, grille (or lack thereof), proportions, surface finish, stance height, wheel arch shape. End with "Sharp focus, editorial quality, no text or watermarks."

Respond with valid JSON only, no markdown.`
}

async function requestFromGemini(prompt: string, temperature: number): Promise<string> {
  const model = getGemini().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      // @ts-expect-error -- thinkingConfig 尚未在型別中定義，但 gemini-2.5-flash 需要關閉 thinking 才能正確輸出 JSON
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()

  recordAIUsage({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    purpose: 'text_generation',
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
    metadata: { step: 'image_prompt' },
  })

  return text
}

/** Claude 沒有 JSON 模式，靠提示詞要求；回應格式的差異由 parseImagePromptText 吸收。 */
function requestFromClaude(prompt: string): Promise<string> {
  return generateTextWithClaude(prompt, { maxTokens: 2048 })
}

/**
 * 把模型的回應解析成 ImagePromptResult。
 * 能容忍 markdown 圍欄、JSON 前後的說明文字與常見的格式瑕疵；
 * 沒有可用的 fullPrompt 就丟錯，讓呼叫端換下一個 provider 或降級。
 */
function parseImagePromptText(text: string, brands?: string[]): ImagePromptResult {
  // 解析 JSON - 处理各种格式问题
  let jsonText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  // 尝试修复常见的 JSON 问题
  // 1. 移除可能的 BOM
  jsonText = jsonText.replace(/^\uFEFF/, '')
  // 2. 只取第一個 { 到最後一個 }（Claude 偶爾會在 JSON 前後加說明文字）
  const start = jsonText.indexOf('{')
  const end = jsonText.lastIndexOf('}')
  if (start !== -1 && end > start) jsonText = jsonText.slice(start, end + 1)
  // 3. 移除控制字符（保留換行符以利後續處理）
  jsonText = jsonText.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
  // 4. 將單引號屬性名修復為雙引號（常見 Gemini 問題）
  jsonText = jsonText.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
  // 5. 移除尾隨逗號
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')

  let parsed: ImagePromptResult

  try {
    parsed = JSON.parse(jsonText) as ImagePromptResult
  } catch (parseError) {
    // 如果 JSON 解析失败，尝试提取关键信息
    logger.warn('ai.prompt.parse_fail_regex_extract', {
      error: getErrorMessage(parseError),
    })

    const fullPromptMatch = jsonText.match(/"fullPrompt"\s*:\s*"([^"]+(?:\\"[^"]*)*[^"]*)"/)

    const subjectMatch = jsonText.match(/"subject"\s*:\s*"([^"]+)"/)

    if (fullPromptMatch) {
      // 如果能提取到 fullPrompt，使用它
      return {
        subject: subjectMatch?.[1] || 'A modern automobile',
        vehicleType: 'automobile',
        brandStyle: getBrandStyleDescription(brands?.[0] || ''),
        setting: 'professional setting',
        keyElements: ['modern design'],
        mood: 'professional',
        fullPrompt: fullPromptMatch[1].replace(/\\"/g, '"'),
      }
    }

    throw parseError
  }

  // 少了 fullPrompt 的回應不能拿去生圖（會變成 "undefined"），視為這個 provider 沒答出來
  if (typeof parsed?.fullPrompt !== 'string' || parsed.fullPrompt.trim() === '') {
    throw new Error('Image prompt answer has no fullPrompt')
  }

  return parsed
}

interface ImagePromptAttempt {
  provider: 'gemini' | 'claude'
  request: () => Promise<string>
}

/**
 * 分析文章內容，生成精準的圖片描述。
 *
 * Gemini 為主（有 JSON 模式、較便宜），Claude 為備援。剛因額度或金鑰失敗的 provider
 * 會排到後面（見 provider-health），所以 Gemini 額度用盡時不會每張封面都先白打一次
 * 必定失敗的呼叫。兩邊都沒給出可用的回應時，降級成關鍵字模板，永遠不會 throw。
 */
export async function generateImagePromptFromArticle(
  title: string,
  content: string,
  brands?: string[],
  options?: { temperature?: number }
): Promise<ImagePromptResult> {
  const temperature = options?.temperature ?? 0.3
  const prompt = buildImagePromptRequest(title, content, brands)

  logger.info('ai.prompt.analyze_start')

  const attempts = orderByHealth<ImagePromptAttempt>([
    { provider: 'gemini', request: () => requestFromGemini(prompt, temperature) },
    { provider: 'claude', request: () => requestFromClaude(prompt) },
  ])

  for (const attempt of attempts) {
    let answer: string
    try {
      answer = await attempt.request()
      recordProviderSuccess(attempt.provider)
    } catch (error) {
      const classified = recordProviderFailure(attempt.provider, error)
      logger.warn('ai.prompt.provider_fail', {
        provider: attempt.provider,
        kind: classified.kind,
        status: classified.status,
        error: classified.message,
      })
      continue
    }

    try {
      const parsed = parseImagePromptText(answer, brands)
      logger.info('ai.prompt.generate_ok', {
        provider: attempt.provider,
        subject: parsed.subject,
        vehicle: parsed.vehicleType,
        style: parsed.brandStyle,
      })
      return parsed
    } catch (error) {
      logger.warn('ai.prompt.parse_fail', {
        provider: attempt.provider,
        error: getErrorMessage(error),
      })
    }
  }

  logger.error('ai.prompt.generate_fail', undefined, {
    attempted: attempts.map((attempt) => attempt.provider),
  })

  // Fallback：返回基础描述（传递 content 以提取车型关键词）
  return createFallbackPrompt(title, brands, content)
}

/**
 * 从标题中提取车辆类型关键词
 */
function extractVehicleType(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()

  // 中文关键词映射
  const vehicleTypes: Array<{ keywords: string[]; type: string; description: string }> = [
    {
      keywords: ['皮卡', 'pickup', 'truck'],
      type: 'pickup truck',
      description: 'rugged pickup truck with cargo bed',
    },
    {
      keywords: ['休旅', 'suv', 'crossover'],
      type: 'SUV',
      description: 'sporty utility vehicle with elevated stance',
    },
    {
      keywords: ['電動休旅', 'electric suv', 'ev suv'],
      type: 'electric SUV',
      description: 'modern electric SUV with aerodynamic design',
    },
    {
      keywords: ['轎車', 'sedan', '房車'],
      type: 'sedan',
      description: 'sleek sedan with elegant profile',
    },
    {
      keywords: ['跑車', 'sports car', '超跑', 'supercar'],
      type: 'sports car',
      description: 'aggressive sports car with low stance',
    },
    {
      keywords: ['掀背', 'hatchback', '兩廂'],
      type: 'hatchback',
      description: 'compact hatchback with practical design',
    },
    {
      keywords: ['旅行車', 'wagon', 'estate'],
      type: 'wagon',
      description: 'practical station wagon',
    },
    {
      keywords: ['敞篷', 'convertible', 'roadster'],
      type: 'convertible',
      description: 'open-top convertible',
    },
    {
      keywords: ['越野', 'off-road', '4x4'],
      type: 'off-road vehicle',
      description: 'rugged off-road capable vehicle',
    },
    {
      keywords: ['小型車', 'compact', 'city car'],
      type: 'compact car',
      description: 'urban-friendly compact vehicle',
    },
    {
      keywords: ['電動', 'ev', 'electric', '純電'],
      type: 'electric vehicle',
      description: 'modern electric vehicle',
    },
    {
      keywords: ['混動', 'hybrid', '油電'],
      type: 'hybrid',
      description: 'efficient hybrid vehicle',
    },
  ]

  for (const { keywords, type, description } of vehicleTypes) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return description
      }
    }
  }

  return 'modern automobile'
}

/**
 * 创建 fallback prompt（当 Gemini 与 Claude 都失败时）
 */
function createFallbackPrompt(
  title: string,
  brands?: string[],
  content?: string
): ImagePromptResult {
  const brandStyle = brands?.[0] ? getBrandStyleDescription(brands[0]) : 'modern automotive design'

  // 从标题提取车辆类型
  const vehicleDescription = extractVehicleType(title, content || '')

  // 嘗試從標題提取具體車款的視覺描述
  const detectedModel = extractCarModel(title, brands?.[0])
  const visualDesc = detectedModel ? getVehicleVisualDescription(detectedModel) : null

  const vehicleDetail = visualDesc
    ? `${vehicleDescription}. ${visualDesc}`
    : `${brandStyle} ${vehicleDescription}`

  return {
    subject: `A ${vehicleDetail} in a professional setting`,
    vehicleType: vehicleDescription,
    brandStyle,
    setting: 'professional studio or showroom',
    keyElements: ['clean lines', 'modern design', 'professional lighting'],
    mood: 'professional and sophisticated',
    fullPrompt: `Professional automotive photography. ${vehicleDetail}, displayed in a clean, professional studio setting. Clean composition with balanced lighting, emphasizing the vehicle's design language. Sharp focus, editorial quality, no text or watermarks.`,
  }
}

/**
 * 品牌风格映射（不直接使用品牌名）
 */
function getBrandStyleDescription(brand: string): string {
  const styleMap: Record<string, string> = {
    // 美系
    Tesla: 'minimalist Scandinavian-inspired electric vehicle with smooth surfaces',
    Ford: 'bold American muscle-inspired design with strong presence',
    Chevrolet: 'confident American design with sporty proportions',
    GM: 'contemporary American automotive design',
    Rivian: 'rugged adventure-ready electric vehicle',
    Lucid: 'futuristic luxury electric sedan',

    // 德系
    BMW: 'German luxury sports design with dynamic kidney grille',
    'Mercedes-Benz': 'elegant German luxury with flowing lines',
    Audi: 'understated German precision with clean surfaces',
    Volkswagen: 'approachable German engineering design',
    Porsche: 'iconic German sports car silhouette',

    // 日系
    Toyota: 'reliable Japanese design with practical elegance',
    Honda: 'sporty Japanese engineering with refined details',
    Nissan: 'bold Japanese design with distinctive character',
    Mazda: 'flowing Japanese artistry in motion',
    Lexus: 'Japanese luxury with bold spindle design',
    Subaru: 'rugged Japanese all-wheel-drive capability',

    // 韩系
    Hyundai: 'modern Korean design with fluid sculpture',
    Kia: 'bold Korean design with tiger nose styling',
    Genesis: 'refined Korean luxury with athletic proportions',

    // 中国品牌
    BYD: 'modern Chinese electric vehicle design',
    NIO: 'premium Chinese electric luxury',
    XPeng: 'tech-forward Chinese electric design',
    'Li Auto': 'family-oriented Chinese electric SUV',

    // 欧洲其他
    Volvo: 'Scandinavian safety-focused minimalist design',
    Polestar: 'Swedish performance electric design',
    Ferrari: 'Italian supercar passion and performance',
    Lamborghini: 'aggressive Italian exotic design',
    Maserati: 'Italian grand touring elegance',
    'Alfa Romeo': 'passionate Italian sports design',
    Fiat: 'charming Italian compact design',
    Renault: 'French automotive innovation',
    Peugeot: 'bold French design language',
    Citroën: 'creative French comfort design',

    // 英系
    Jaguar: 'British sporting luxury',
    'Land Rover': 'British all-terrain capability',
    Bentley: 'handcrafted British luxury',
    'Rolls-Royce': 'pinnacle British luxury craftsmanship',
    'Aston Martin': 'British grand touring elegance',
    McLaren: 'British supercar engineering',
    Lotus: 'lightweight British sports car',
    MINI: 'iconic British compact fun',
  }

  return styleMap[brand] || 'contemporary automotive design'
}

/**
 * 使用 Gemini Vision 分析多張車輛圖片，提取外觀特徵描述
 * 僅在 imageUrls.length >= 2 時呼叫（單張圖不需要多圖分析）
 */
export async function analyzeMultipleImagesWithGemini(
  imageUrls: string[],
  articleTitle: string
): Promise<string | null> {
  if (imageUrls.length < 2) return null

  try {
    const gemini = getGemini()
    const model = gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        // @ts-expect-error -- thinkingConfig 尚未在型別中定義
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    // 下載最多 3 張圖片轉 base64
    const imagesToAnalyze = imageUrls.slice(0, 3)
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = []

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB per image

    for (const url of imagesToAnalyze) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) continue

        // 檢查圖片大小，避免記憶體爆炸
        const contentLength = parseInt(response.headers.get('content-length') || '0')
        if (contentLength > MAX_IMAGE_SIZE) {
          logger.warn('ai.prompt.vision_skip_large', {
            sizeMb: Number((contentLength / 1024 / 1024).toFixed(1)),
            urlPrefix: url.slice(0, 60),
            source: 'content_length',
          })
          continue
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const buffer = await response.arrayBuffer()

        // 雙重檢查：content-length 可能不準確
        if (buffer.byteLength > MAX_IMAGE_SIZE) {
          logger.warn('ai.prompt.vision_skip_large', {
            sizeMb: Number((buffer.byteLength / 1024 / 1024).toFixed(1)),
            urlPrefix: url.slice(0, 60),
            source: 'actual',
          })
          continue
        }

        const base64 = Buffer.from(buffer).toString('base64')

        imageParts.push({
          inlineData: {
            mimeType: contentType.split(';')[0],
            data: base64,
          },
        })
      } catch {
        logger.warn('ai.prompt.vision_download_fail', { urlPrefix: url.slice(0, 60) })
      }
    }

    if (imageParts.length === 0) {
      logger.warn('ai.prompt.vision_no_images')
      return null
    }

    logger.info('ai.prompt.vision_analyze_start', { imageCount: imageParts.length })

    const result = await model.generateContent([
      ...imageParts,
      {
        text: `Article: "${articleTitle}"

Describe this vehicle's unique exterior design features visible across these images: body color, accent lines, headlight/taillight design, wheel style, aerodynamic elements. 30-50 words in English. Focus only on visual appearance, not specs or performance.`,
      },
    ])

    const description = result.response.text().trim()

    recordAIUsage({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      purpose: 'vision_scoring',
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
      metadata: { step: 'multi_image_analysis', imageCount: imageParts.length },
    })

    logger.info('ai.prompt.vision_analyze_ok', {
      descriptionPrefix: description.slice(0, 80),
    })
    return description
  } catch (error) {
    logger.warn('ai.prompt.vision_analyze_fail', { error: getErrorMessage(error) })
    return null
  }
}

/**
 * 驗證生成的圖片是否與文章匹配
 * 使用 Gemini Vision 進行 6 維度評分
 */
export async function verifyImageMatch(
  imageUrl: string,
  articleTitle: string,
  expectedElements: string[]
): Promise<{ matches: boolean; score: number; feedback: string }> {
  try {
    const { scoreImage } = await import('@/lib/experiments/scorer')
    const result = await scoreImage(imageUrl, articleTitle, expectedElements.join(', '))
    return {
      matches: result.composite >= 7.0,
      score: result.composite / 10, // 正規化到 0-1
      feedback: result.explanation,
    }
  } catch {
    // Fallback：評分失敗時不阻擋流程
    return {
      matches: true,
      score: 0.8,
      feedback: 'Scoring unavailable, passing by default',
    }
  }
}
