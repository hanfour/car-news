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
 * 為汽車新聞優化的 Flux prompt
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
