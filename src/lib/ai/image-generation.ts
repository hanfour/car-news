import 'server-only'
/**
 * AI 圖片生成工具
 * 優先使用 Flux（$0.008/張），DALL-E 3 作為備選（$0.04/張）
 *
 * 改进：使用 Gemini 智能分析文章内容，确保图文匹配
 */

import OpenAI from 'openai'
import { getErrorMessage } from '@/lib/utils/error'
import { generateImagePromptFromArticle, analyzeMultipleImagesWithGemini } from './image-prompt-generator'
import { generateWithFlux, generateWithFluxImg2Img, buildFluxPrompt, buildImg2ImgPrompt, selectScene } from './flux-image-generation'
import type { ExperimentParams } from '@/lib/experiments/types'
import { logger } from '@/lib/logger'

// ============================================================
// Promoted config 快取（避免每次生成圖片都查 DB）
// ============================================================
let cachedPromotedParams: ExperimentParams | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 分鐘

async function getPromotedParams(): Promise<ExperimentParams | null> {
  const now = Date.now()
  if (cachedPromotedParams && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPromotedParams
  }
  try {
    const { getPromotedConfig } = await import('@/lib/experiments/results')
    const config = await getPromotedConfig()
    if (config?.params) {
      cachedPromotedParams = config.params
      cacheTimestamp = now
      logger.info('ai.image.promoted_config_loaded', {
        guidance: config.params.guidance_scale,
        steps: config.params.num_inference_steps,
        temp: config.params.gemini_temperature,
      })
      return config.params
    }
  } catch {
    // DB 不可用時靜默 fallback 到 hardcoded 預設值
  }
  return null
}

// 圖片生成提供商選項
export type ImageProvider = 'flux' | 'dalle' | 'auto'

// Lazy initialization to ensure env vars are loaded first
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

interface ImageGenerationResult {
  url: string
  revisedPrompt?: string
  error?: string
  provider?: 'flux' | 'dalle'
  cost?: number
}

/**
 * 為汽車新聞生成封面圖片
 * 優先使用 Flux（便宜），失敗時 fallback 到 DALL-E 3
 *
 * @param provider - 'flux' | 'dalle' | 'auto'（預設 auto，優先 Flux）
 */
export async function generateCoverImage(
  title: string,
  content: string,
  brands?: string[],
  provider: ImageProvider = 'auto',
  qualityBoost?: boolean
): Promise<ImageGenerationResult | null> {
  try {
    // 讀取 DB 中 promoted 的最佳參數（有快取，10 分鐘 TTL）
    const promoted = await getPromotedParams()

    // 使用 Gemini 智能分析文章，生成精准的图片描述
    logger.info('ai.image.analyze_start')
    const promptResult = await generateImagePromptFromArticle(
      title, content, brands,
      promoted ? { temperature: promoted.gemini_temperature } : undefined
    )
    const prompt = promptResult.fullPrompt

    // 決定使用哪個提供商
    const useFlux = provider === 'flux' || (provider === 'auto' && process.env.FAL_KEY)
    const useDalle = provider === 'dalle' || !useFlux

    // 嘗試 Flux（更便宜：$0.008/張）
    if (useFlux) {
      logger.info('ai.image.flux_attempt', { costEst: 0.008 })

      const fluxPrompt = buildFluxPrompt(promptResult.fullPrompt, title, brands?.[0], undefined, qualityBoost)
      const fluxResult = await generateWithFlux(fluxPrompt, {
        guidanceScale: promoted?.guidance_scale,
        numInferenceSteps: promoted?.num_inference_steps,
      })

      if (fluxResult && fluxResult.url && !fluxResult.error) {
        logger.info('ai.image.flux_ok')
        return {
          url: fluxResult.url,
          revisedPrompt: fluxPrompt,
          provider: 'flux',
          cost: 0.008
        }
      }

      // Flux 失敗，如果是 auto 模式則 fallback 到 DALL-E
      if (provider === 'auto') {
        logger.warn('ai.image.flux_fallback_dalle')
      } else {
        // 明確指定 Flux 但失敗
        return {
          url: '',
          error: fluxResult?.error || 'Flux generation failed',
          provider: 'flux',
          cost: 0
        }
      }
    }

    // 使用 DALL-E 3（$0.04/張）
    if (useDalle || provider === 'auto') {
      logger.info('ai.image.dalle_start', {
        costEst: 0.04,
        promptPrefix: prompt.slice(0, 100),
      })

      const response = await getOpenAI().images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        style: 'natural'
      })

      const imageUrl = response.data?.[0]?.url
      const revisedPrompt = response.data?.[0]?.revised_prompt

      if (!imageUrl) {
        logger.error('ai.image.dalle_no_url')
        return null
      }

      logger.info('ai.image.dalle_ok', { urlPrefix: imageUrl.slice(0, 60) })

      return {
        url: imageUrl,
        revisedPrompt,
        provider: 'dalle',
        cost: 0.04
      }
    }

    return null

  } catch (error) {
    logger.error('ai.image.generate_fail', error)
    return {
      url: '',
      error: getErrorMessage(error)
    }
  }
}

/**
 * 生成並持久化存儲封面圖片
 * 自動將 DALL-E 3 生成的圖片上傳到 Supabase Storage
 *
 * @param title 文章標題
 * @param content 文章內容
 * @param brands 品牌列表
 * @param referenceImages 可選的參考圖片（用於生成更準確的變體）
 */
export async function generateAndSaveCoverImage(
  title: string,
  content: string,
  brands?: string[],
  referenceImages?: Array<{ url: string; caption?: string; size?: number }>
): Promise<{ url: string; credit: string } | null> {

  // 策略 1: 如果有參考圖片，優先使用 Flux Image-to-Image
  if (referenceImages && referenceImages.length > 0) {
    logger.info('ai.image.ref_img2img_try', { refCount: referenceImages.length })

    // 選擇最大的圖片作為參考（通常品質最好）
    const bestRef = referenceImages.reduce((best, current) => {
      const currentSize = current.size || 0
      const bestSize = best.size || 0
      return currentSize > bestSize ? current : best
    }, referenceImages[0])

    // 只有在有 FAL_KEY 時才嘗試 Flux img2img
    if (process.env.FAL_KEY && bestRef.url) {
      try {
        // 使用 Gemini 分析文章生成車輛描述
        const promptResult = await generateImagePromptFromArticle(title, content, brands)

        // 多圖分析：提取跨圖片的車輛外觀特徵
        let multiImageDescription: string | undefined
        if (referenceImages.length >= 2) {
          const imageUrls = referenceImages.map(r => r.url).filter(Boolean)
          const analysis = await analyzeMultipleImagesWithGemini(imageUrls, title)
          if (analysis) {
            multiImageDescription = analysis
          }
        }

        // 選擇適合的場景
        const scene = selectScene(promptResult.vehicleType)
        logger.info('ai.image.scene_selected', { scene })

        // 為 img2img 建立專用 prompt，包含多圖特徵 + 場景
        const vehicleDesc = multiImageDescription || promptResult.vehicleType
        const img2imgPrompt = buildImg2ImgPrompt(title, brands?.[0], vehicleDesc, scene)
        logger.info('ai.image.img2img_prompt_built', {
          promptPrefix: img2imgPrompt.slice(0, 100),
        })

        const img2imgResult = await generateWithFluxImg2Img(
          bestRef.url,
          img2imgPrompt,
          { strength: 0.3 }  // 保留 70% 原圖特徵，最大化與實際車款的相似度
        )

        if (img2imgResult && img2imgResult.url && !img2imgResult.error) {
          logger.info('ai.image.ref_img2img_ok')

          // 上傳到永久存儲
          const { uploadImageFromUrl } = await import('@/lib/storage/image-uploader')
          const timestamp = Date.now()
          const brandPrefix = brands && brands.length > 0 ? brands[0].toLowerCase() : 'auto'
          const fileName = `flux-ref-${brandPrefix}-${timestamp}`

          const permanentUrl = await uploadImageFromUrl(img2imgResult.url, fileName, true)

          return {
            url: permanentUrl || img2imgResult.url,
            credit: 'AI 生成示意圖 (Flux + 參考圖)'
          }
        }
      } catch (error) {
        logger.warn('ai.image.ref_img2img_error', { error: getErrorMessage(error) })
      }
    }

    // Fallback: 嘗試舊的 DALL-E variation 方法
    try {
      const { generateCoverFromBestReference } = await import('@/lib/ai/image-variation')
      const variationResult = await generateCoverFromBestReference(referenceImages)

      if (variationResult && variationResult.url) {
        logger.info('ai.image.variation_ok')
        return variationResult
      } else {
        logger.warn('ai.image.variation_fail_fallback_t2i')
      }
    } catch (error) {
      logger.warn('ai.image.variation_error_fallback_t2i', { error: getErrorMessage(error) })
    }
  }

  // 策略 2: Fallback 到純文字生成（優先 Flux，備選 DALL-E 3）
  logger.info('ai.image.t2i_start')

  const result = await generateCoverImage(title, content, brands, 'auto')

  if (!result || !result.url) {
    return null
  }

  // 上傳到持久化存儲
  const { uploadImageFromUrl } = await import('@/lib/storage/image-uploader')

  const timestamp = Date.now()
  const brandPrefix = brands && brands.length > 0 ? brands[0].toLowerCase() : 'auto'
  const providerPrefix = result.provider === 'flux' ? 'flux' : 'dalle'
  const fileName = `${providerPrefix}-${brandPrefix}-${timestamp}`

  logger.info('ai.image.upload_start')
  const permanentUrl = await uploadImageFromUrl(result.url, fileName, true)

  // 根據使用的提供商設定 credit
  const providerName = result.provider === 'flux' ? 'Flux' : 'DALL-E 3'
  const costInfo = result.cost ? ` ($${result.cost.toFixed(3)})` : ''

  if (!permanentUrl) {
    logger.warn('ai.image.upload_fail_temp_url')
    return {
      url: result.url,
      credit: `AI 生成示意圖 (${providerName})${costInfo} - Temporary URL`
    }
  }

  logger.info('ai.image.upload_ok', { provider: providerName, cost: costInfo })
  return {
    url: permanentUrl,
    credit: `AI 生成示意圖 (${providerName})`
  }
}
