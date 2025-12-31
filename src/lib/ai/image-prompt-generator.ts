/**
 * 用 Gemini 智能分析文章，生成精准的图片描述
 * 确保 AI 生成的封面图与文章内容匹配
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getErrorMessage } from '@/lib/utils/error'

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

/**
 * 用 Gemini 分析文章内容，生成精准的图片描述
 */
export async function generateImagePromptFromArticle(
  title: string,
  content: string,
  brands?: string[]
): Promise<ImagePromptResult> {
  const gemini = getGemini()
  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3, // 低温度确保稳定输出
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  })

  // 简化的 prompt，只要求生成 fullPrompt
  const prompt = `Generate an image prompt for this automotive news article.

Title: ${title}
Content: ${content.slice(0, 800)}
Brand: ${brands?.[0] || 'generic'}

Rules:
1. This is a NEWS ILLUSTRATION, not an official photo
2. Describe the vehicle by design style, NOT by brand name
3. Use descriptive terms like "minimalist electric sedan" instead of "Tesla Model 3"

Output a JSON object with these fields:
- subject: main visual subject (e.g., "front view of a sleek electric sedan")
- vehicleType: type of vehicle
- brandStyle: design language description (without brand names)
- setting: environment/location
- keyElements: array of 3 key visual elements
- mood: overall atmosphere
- fullPrompt: complete English prompt for DALL-E (150-200 words), starting with "Professional automotive news illustration, editorial style." and ending with "Clean composition, no text or logos, suitable for news article."

Respond with valid JSON only, no markdown.`

  try {
    console.log('→ Analyzing article with Gemini for image prompt...')

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // 解析 JSON - 处理各种格式问题
    let jsonText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // 尝试修复常见的 JSON 问题
    // 1. 移除可能的 BOM
    jsonText = jsonText.replace(/^\uFEFF/, '')
    // 2. 移除控制字符
    jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, ' ')

    let parsed: ImagePromptResult

    try {
      parsed = JSON.parse(jsonText) as ImagePromptResult
    } catch (parseError) {
      // 如果 JSON 解析失败，尝试提取关键信息
      console.warn('⚠ JSON parse failed, trying regex extraction...')

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
          fullPrompt: fullPromptMatch[1].replace(/\\"/g, '"')
        }
      }

      throw parseError
    }

    console.log('✓ Image prompt generated:')
    console.log(`   Subject: ${parsed.subject}`)
    console.log(`   Vehicle: ${parsed.vehicleType}`)
    console.log(`   Style: ${parsed.brandStyle}`)

    return parsed

  } catch (error) {
    console.error('✗ Gemini prompt generation failed:', getErrorMessage(error))

    // Fallback：返回基础描述（传递 content 以提取车型关键词）
    return createFallbackPrompt(title, brands, content)
  }
}

/**
 * 从标题中提取车辆类型关键词
 */
function extractVehicleType(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()

  // 中文关键词映射
  const vehicleTypes: Array<{ keywords: string[]; type: string; description: string }> = [
    { keywords: ['皮卡', 'pickup', 'truck'], type: 'pickup truck', description: 'rugged pickup truck with cargo bed' },
    { keywords: ['休旅', 'suv', 'crossover'], type: 'SUV', description: 'sporty utility vehicle with elevated stance' },
    { keywords: ['電動休旅', 'electric suv', 'ev suv'], type: 'electric SUV', description: 'modern electric SUV with aerodynamic design' },
    { keywords: ['轎車', 'sedan', '房車'], type: 'sedan', description: 'sleek sedan with elegant profile' },
    { keywords: ['跑車', 'sports car', '超跑', 'supercar'], type: 'sports car', description: 'aggressive sports car with low stance' },
    { keywords: ['掀背', 'hatchback', '兩廂'], type: 'hatchback', description: 'compact hatchback with practical design' },
    { keywords: ['旅行車', 'wagon', 'estate'], type: 'wagon', description: 'practical station wagon' },
    { keywords: ['敞篷', 'convertible', 'roadster'], type: 'convertible', description: 'open-top convertible' },
    { keywords: ['越野', 'off-road', '4x4'], type: 'off-road vehicle', description: 'rugged off-road capable vehicle' },
    { keywords: ['小型車', 'compact', 'city car'], type: 'compact car', description: 'urban-friendly compact vehicle' },
    { keywords: ['電動', 'ev', 'electric', '純電'], type: 'electric vehicle', description: 'modern electric vehicle' },
    { keywords: ['混動', 'hybrid', '油電'], type: 'hybrid', description: 'efficient hybrid vehicle' },
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
 * 创建 fallback prompt（当 Gemini 分析失败时）
 */
function createFallbackPrompt(title: string, brands?: string[], content?: string): ImagePromptResult {
  const brandStyle = brands?.[0]
    ? getBrandStyleDescription(brands[0])
    : 'modern automotive design'

  // 从标题提取车辆类型
  const vehicleDescription = extractVehicleType(title, content || '')

  return {
    subject: `A ${vehicleDescription} in a professional setting`,
    vehicleType: vehicleDescription,
    brandStyle,
    setting: 'professional studio or showroom',
    keyElements: ['clean lines', 'modern design', 'professional lighting'],
    mood: 'professional and sophisticated',
    fullPrompt: `Professional automotive news illustration, editorial style. A ${brandStyle} ${vehicleDescription} displayed in a clean, professional studio setting. Clean composition with balanced lighting, emphasizing the vehicle's design language. No text, logos, or watermarks. Suitable for news article header image.`
  }
}

/**
 * 品牌风格映射（不直接使用品牌名）
 */
function getBrandStyleDescription(brand: string): string {
  const styleMap: Record<string, string> = {
    // 美系
    'Tesla': 'minimalist Scandinavian-inspired electric vehicle with smooth surfaces',
    'Ford': 'bold American muscle-inspired design with strong presence',
    'Chevrolet': 'confident American design with sporty proportions',
    'GM': 'contemporary American automotive design',
    'Rivian': 'rugged adventure-ready electric vehicle',
    'Lucid': 'futuristic luxury electric sedan',

    // 德系
    'BMW': 'German luxury sports design with dynamic kidney grille',
    'Mercedes-Benz': 'elegant German luxury with flowing lines',
    'Audi': 'understated German precision with clean surfaces',
    'Volkswagen': 'approachable German engineering design',
    'Porsche': 'iconic German sports car silhouette',

    // 日系
    'Toyota': 'reliable Japanese design with practical elegance',
    'Honda': 'sporty Japanese engineering with refined details',
    'Nissan': 'bold Japanese design with distinctive character',
    'Mazda': 'flowing Japanese artistry in motion',
    'Lexus': 'Japanese luxury with bold spindle design',
    'Subaru': 'rugged Japanese all-wheel-drive capability',

    // 韩系
    'Hyundai': 'modern Korean design with fluid sculpture',
    'Kia': 'bold Korean design with tiger nose styling',
    'Genesis': 'refined Korean luxury with athletic proportions',

    // 中国品牌
    'BYD': 'modern Chinese electric vehicle design',
    'NIO': 'premium Chinese electric luxury',
    'XPeng': 'tech-forward Chinese electric design',
    'Li Auto': 'family-oriented Chinese electric SUV',

    // 欧洲其他
    'Volvo': 'Scandinavian safety-focused minimalist design',
    'Polestar': 'Swedish performance electric design',
    'Ferrari': 'Italian supercar passion and performance',
    'Lamborghini': 'aggressive Italian exotic design',
    'Maserati': 'Italian grand touring elegance',
    'Alfa Romeo': 'passionate Italian sports design',
    'Fiat': 'charming Italian compact design',
    'Renault': 'French automotive innovation',
    'Peugeot': 'bold French design language',
    'Citroën': 'creative French comfort design',

    // 英系
    'Jaguar': 'British sporting luxury',
    'Land Rover': 'British all-terrain capability',
    'Bentley': 'handcrafted British luxury',
    'Rolls-Royce': 'pinnacle British luxury craftsmanship',
    'Aston Martin': 'British grand touring elegance',
    'McLaren': 'British supercar engineering',
    'Lotus': 'lightweight British sports car',
    'MINI': 'iconic British compact fun',
  }

  return styleMap[brand] || 'contemporary automotive design'
}

/**
 * 验证生成的图片是否与文章匹配（可选，用于质量控制）
 * 使用 GPT-4V 或 Gemini Vision
 */
export async function verifyImageMatch(
  imageUrl: string,
  articleTitle: string,
  expectedElements: string[]
): Promise<{ matches: boolean; score: number; feedback: string }> {
  // TODO: 实现图片验证逻辑
  // 目前返回默认通过
  return {
    matches: true,
    score: 0.8,
    feedback: 'Image verification not yet implemented'
  }
}
