import 'server-only'
/**
 * Fal.ai Flux SDK 薄封裝
 *
 * 負責：
 * - 配置 fal client（configureFal）
 * - 封裝 text-to-image（generateWithFlux / generateWithFluxSchnell）
 * - 封裝 image-to-image（generateWithFluxImg2Img）
 * - 統一 error handling 與 logging（行為零改動）
 *
 * 從原 flux-image-generation.ts 拆出。
 */

import { fal } from '@fal-ai/client'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

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
    /** Override: guidance_scale (default 3.5, optimized from 5.0) */
    guidanceScale?: number
    /** Override: num_inference_steps (default 28) */
    numInferenceSteps?: number
    /** Override: 固定 seed 確保可重現 */
    seed?: number
  } = {}
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    const {
      imageSize = 'landscape_16_9',
      numImages = 1,
      guidanceScale = 3.5,
      numInferenceSteps = 28,
      seed,
    } = options

    logger.info('ai.flux.generate_start', {
      promptPrefix: prompt.slice(0, 200),
      imageSize,
      guidanceScale,
      numInferenceSteps,
      seed: seed ?? null,
    })

    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt,
        image_size: imageSize,
        num_images: numImages,
        enable_safety_checker: true,
        num_inference_steps: numInferenceSteps,
        guidance_scale: guidanceScale,
        ...(seed != null ? { seed } : {}),
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      logger.error('ai.flux.no_url_returned')
      return null
    }

    logger.info('ai.flux.generate_ok', { urlPrefix: imageUrl.slice(0, 60) })

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.008
    }

  } catch (error) {
    logger.error('ai.flux.generate_fail', error)
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
 */
export async function generateWithFluxSchnell(
  prompt: string
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    logger.info('ai.flux.schnell_start')

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
        enable_safety_checker: true,
        num_inference_steps: 4
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      logger.error('ai.flux.schnell_no_url')
      return null
    }

    logger.info('ai.flux.schnell_ok')

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.003
    }

  } catch (error) {
    logger.error('ai.flux.schnell_fail', error)
    return null
  }
}

/**
 * 使用參考圖片生成新圖片（Image-to-Image）
 */
export async function generateWithFluxImg2Img(
  referenceImageUrl: string,
  prompt: string,
  options: {
    strength?: number
  } = {}
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    const { strength = 0.75 } = options

    logger.info('ai.flux.img2img_start', {
      referencePrefix: referenceImageUrl.slice(0, 60),
      strength,
    })

    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: referenceImageUrl,
        prompt,
        strength,
        num_inference_steps: 28,
        guidance_scale: 5.0,
        enable_safety_checker: true
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      logger.error('ai.flux.img2img_no_url')
      return null
    }

    logger.info('ai.flux.img2img_ok')

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.025
    }

  } catch (error) {
    logger.error('ai.flux.img2img_fail', error)
    return null
  }
}
