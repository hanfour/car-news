/**
 * Flux 圖片生成工具
 * 使用 fal.ai 的 Flux 模型生成封面圖
 * 成本僅 $0.008/張，比 DALL-E 3 便宜 5 倍
 */

import { fal } from '@fal-ai/client'
import { getErrorMessage } from '@/lib/utils/error'

// 配置 fal.ai
let configured = false

function configureFal() {
  if (configured) return

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is required')
  }

  fal.config({
    credentials: apiKey
  })
  configured = true
}

interface FluxImageResult {
  url: string
  width: number
  height: number
  content_type: string
}

interface FluxGenerationResult {
  images: FluxImageResult[]
  prompt: string
  seed: number
  has_nsfw_concepts: boolean[]
}

export interface ImageGenerationResult {
  url: string
  revisedPrompt?: string
  error?: string
  provider: 'flux' | 'dalle'
  cost: number
}

/**
 * 使用 Flux 生成封面圖片
 * 模型：fal-ai/flux/dev（開源版本，品質好）
 */
export async function generateWithFlux(
  prompt: string,
  options: {
    imageSize?: 'landscape_16_9' | 'landscape_4_3' | 'square' | 'portrait_4_3'
    numImages?: number
  } = {}
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    const {
      imageSize = 'landscape_16_9',  // 16:9 適合封面圖
      numImages = 1
    } = options

    console.log('→ Generating image with Flux (fal.ai)...')
    console.log(`   Prompt: ${prompt.slice(0, 100)}...`)
    console.log(`   Size: ${imageSize}`)

    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt,
        image_size: imageSize,
        num_images: numImages,
        enable_safety_checker: true,
        num_inference_steps: 28,  // 平衡品質和速度
        guidance_scale: 3.5       // 適中的引導強度
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('✗ Flux returned no image URL')
      return null
    }

    console.log('✓ Flux image generated successfully')
    console.log(`   URL: ${imageUrl.slice(0, 60)}...`)

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.008  // Flux dev 成本約 $0.008/張
    }

  } catch (error) {
    console.error('✗ Flux generation failed:', getErrorMessage(error))
    return {
      url: '',
      error: getErrorMessage(error),
      provider: 'flux',
      cost: 0
    }
  }
}

/**
 * 使用 Flux Schnell（更快但品質稍低）
 * 成本更低，適合大量生成
 */
export async function generateWithFluxSchnell(
  prompt: string
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    console.log('→ Generating image with Flux Schnell (fast mode)...')

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
        enable_safety_checker: true,
        num_inference_steps: 4  // Schnell 只需 4 步
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('✗ Flux Schnell returned no image URL')
      return null
    }

    console.log('✓ Flux Schnell image generated')

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.003  // Schnell 更便宜
    }

  } catch (error) {
    console.error('✗ Flux Schnell failed:', getErrorMessage(error))
    return null
  }
}

/**
 * 為汽車新聞優化的 Flux prompt（純文字生成用）
 */
export function buildFluxPrompt(
  basePrompt: string,
  brand?: string
): string {
  // Flux 對 prompt 的要求比 DALL-E 簡單
  let prompt = 'Professional automotive photography, '

  if (brand) {
    prompt += `${brand} vehicle, `
  }

  prompt += basePrompt

  // 添加品質標籤
  prompt += '. High resolution, studio lighting, clean background, editorial quality, no text or watermarks.'

  return prompt
}

/**
 * 從標題中提取具體車款名稱
 * 例如：「Tesla Model Y 改款登場」→「Tesla Model Y」
 */
export function extractCarModel(title: string, brand?: string): string | null {
  // 常見車款模式
  const modelPatterns = [
    // 英文品牌 + 英文/數字型號
    /\b(Tesla|BMW|Mercedes|Audi|Porsche|Volkswagen|Toyota|Honda|Nissan|Mazda|Lexus|Ford|Chevrolet|Rivian|Lucid|Hyundai|Kia|Genesis|Volvo|Polestar|Jaguar|Ferrari|Lamborghini|McLaren|Bentley|Rolls-Royce|Aston Martin)\s+([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9\-]+)?)/i,
    // 中文品牌 + 英文/數字型號
    /\b(比亞迪|蔚來|小鵬|理想|吉利|長城|威馬|哪吒|零跑|極氪|智己|蔚來|極越|小米|問界|奇瑞)\s*([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9\-]+)?)/,
    // NIO/BYD 等國際名稱
    /\b(NIO|BYD|XPeng|Li Auto|Zeekr|AITO|Xiaomi)\s+([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9\-]+)?)/i,
    // 只有型號的模式（如果已知品牌）
    /\b(Model\s+[3YSX]|EQS|EQE|iX\d*|i[47]|ID\.\d|e-tron|Taycan|Mustang\s+Mach-E|F-150\s+Lightning|Cybertruck|ES\d|ET\d|EC\d|G\d{2}|P\d|L\d{2}|SU7|M7|M9)\b/i,
  ]

  for (const pattern of modelPatterns) {
    const match = title.match(pattern)
    if (match) {
      // 如果匹配到完整品牌+型號
      if (match[2]) {
        return `${match[1]} ${match[2]}`.trim()
      }
      // 如果只匹配到型號，加上品牌
      if (brand && match[1]) {
        return `${brand} ${match[1]}`.trim()
      }
      return match[1]
    }
  }

  return null
}

/**
 * 為 img2img 建立專用 prompt
 * 更具體地描述車款，確保生成圖片與原圖更相似
 */
export function buildImg2ImgPrompt(
  title: string,
  brand?: string,
  vehicleDescription?: string
): string {
  const carModel = extractCarModel(title, brand)

  let prompt = 'Professional automotive press photo, '

  // 如果提取到具體車款，使用它
  if (carModel) {
    prompt += `${carModel}, `
  } else if (brand) {
    prompt += `${brand} vehicle, `
  }

  // 添加車輛描述
  if (vehicleDescription) {
    prompt += `${vehicleDescription}, `
  }

  // 強調保持原始設計特徵
  prompt += 'maintaining original vehicle design proportions and styling, '
  prompt += 'same body shape and distinctive features, '
  prompt += 'professional studio lighting, clean background, '
  prompt += 'sharp focus on vehicle details, editorial quality, '
  prompt += 'no text, no watermarks, no logos.'

  return prompt
}

/**
 * 使用參考圖片生成新圖片（Image-to-Image）
 * 可以基於原文配圖風格生成更準確的封面
 */
export async function generateWithFluxImg2Img(
  referenceImageUrl: string,
  prompt: string,
  options: {
    strength?: number  // 0.0 保留原圖, 1.0 完全重繪
  } = {}
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    const { strength = 0.75 } = options

    console.log('→ Generating image with Flux Image-to-Image...')
    console.log(`   Reference: ${referenceImageUrl.slice(0, 60)}...`)
    console.log(`   Strength: ${strength}`)

    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: referenceImageUrl,
        prompt,
        strength,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        enable_safety_checker: true
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('✗ Flux img2img returned no image URL')
      return null
    }

    console.log('✓ Flux img2img generated successfully')

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.025  // img2img 成本約 $0.025/張
    }

  } catch (error) {
    console.error('✗ Flux img2img failed:', getErrorMessage(error))
    return null
  }
}

// IP-Adapter 功能暫時停用，待 fal.ai SDK 類型更新後再啟用
// export async function generateWithFluxIPAdapter(...) { ... }
