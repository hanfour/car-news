/**
 * Gemini Vision 評分器
 * 對生成的圖片進行 6 維度加權評分
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { ImageScore, ImageScoreDimensions, computeComposite } from './types'
import { getErrorMessage } from '@/lib/utils/error'

let genAI: GoogleGenerativeAI | null = null

function getGemini() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required for image scoring')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

/**
 * 使用 Gemini Vision 對圖片進行 6 維度評分
 */
export async function scoreImage(
  imageUrl: string,
  articleTitle: string,
  promptUsed: string
): Promise<ImageScore> {
  const gemini = getGemini()
  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      // @ts-expect-error -- thinkingConfig 尚未在型別中定義
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  // 下載圖片轉為 base64
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const base64Image = imageBuffer.toString('base64')
  const mimeType = imageResponse.headers.get('content-type') || 'image/webp'

  const scoringPrompt = `You are an automotive image quality evaluator. Score this AI-generated cover image for an automotive news article.

Article title: "${articleTitle}"
Image generation prompt used: "${promptUsed.slice(0, 500)}"

Score each dimension from 0.0 to 10.0:

1. vehicleAccuracy (weight: 30%): Does the vehicle match the description? Are the model, proportions, and distinctive features correct? Is it the right type of vehicle (sedan/SUV/truck/etc)?
2. detailFidelity (weight: 20%): Are specific design elements present? (grille shape, headlight design, body lines, proportions)
3. composition (weight: 15%): Professional framing? Clean background? No text artifacts or watermarks?
4. mood (weight: 10%): Does the atmosphere match what a news article would need?
5. technicalQuality (weight: 15%): Sharpness, lighting quality, no AI artifacts (melted surfaces, extra wheels, distorted proportions)?
6. editorialFit (weight: 10%): Could this be used as a news article cover image? Does it look professional?

Output a JSON object:
{
  "vehicleAccuracy": <number>,
  "detailFidelity": <number>,
  "composition": <number>,
  "mood": <number>,
  "technicalQuality": <number>,
  "editorialFit": <number>,
  "explanation": "<2-3 sentences explaining the scores>"
}

Be strict but fair. 7.0+ is acceptable, 8.0+ is excellent. Common AI issues that should lower scores: wrong vehicle type, melted/distorted surfaces, extra body parts, text in image, unnatural proportions.`

  try {
    const result = await model.generateContent([
      { text: scoringPrompt },
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ])

    const text = result.response.text()

    // Gemini 2.5 flash 可能回傳 thinking tokens 或非標準 JSON
    // 嘗試多種解析策略
    let parsed: ImageScoreDimensions & { explanation: string }

    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // 嘗試提取 JSON 物件
      const jsonMatch = text.match(/\{[\s\S]*?"vehicleAccuracy"[\s\S]*?\}/)
      if (!jsonMatch) {
        // 用 regex 提取各分數
        const extract = (key: string): number => {
          const m = text.match(new RegExp(`"${key}"\\s*:\\s*([\\d.]+)`))
          return m ? parseFloat(m[1]) : 5
        }
        const explMatch = text.match(/"explanation"\s*:\s*"([^"]*)"/)
        parsed = {
          vehicleAccuracy: extract('vehicleAccuracy'),
          detailFidelity: extract('detailFidelity'),
          composition: extract('composition'),
          mood: extract('mood'),
          technicalQuality: extract('technicalQuality'),
          editorialFit: extract('editorialFit'),
          explanation: explMatch?.[1] || 'Scores extracted via regex fallback',
        }
      } else {
        // 清理 JSON 字串中的問題
        const fixedJson = jsonMatch[0]
          .replace(/,\s*\}/g, '}')  // 尾隨逗號
          .replace(/[\x00-\x1F]/g, ' ')  // 控制字元
        parsed = JSON.parse(fixedJson)
      }
    }

    const dimensions: ImageScoreDimensions = {
      vehicleAccuracy: clampScore(parsed.vehicleAccuracy),
      detailFidelity: clampScore(parsed.detailFidelity),
      composition: clampScore(parsed.composition),
      mood: clampScore(parsed.mood),
      technicalQuality: clampScore(parsed.technicalQuality),
      editorialFit: clampScore(parsed.editorialFit),
    }

    return {
      dimensions,
      composite: computeComposite(dimensions),
      explanation: parsed.explanation || '',
    }
  } catch (error) {
    console.error('✗ Image scoring failed:', getErrorMessage(error))
    throw error
  }
}

function clampScore(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0
  return Math.round(Math.max(0, Math.min(10, value)) * 100) / 100
}
