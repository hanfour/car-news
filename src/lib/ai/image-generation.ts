/**
 * AI 圖片生成工具
 * 優先使用 Flux（$0.008/張），DALL-E 3 作為備選（$0.04/張）
 *
 * 改进：使用 Gemini 智能分析文章内容，确保图文匹配
 */

import OpenAI from 'openai'
import { getErrorMessage } from '@/lib/utils/error'
import { generateImagePromptFromArticle } from './image-prompt-generator'
import { generateWithFlux, buildFluxPrompt } from './flux-image-generation'

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
  provider: ImageProvider = 'auto'
): Promise<ImageGenerationResult | null> {
  try {
    // 使用 Gemini 智能分析文章，生成精准的图片描述
    console.log('→ Step 1: Analyzing article with Gemini...')
    const promptResult = await generateImagePromptFromArticle(title, content, brands)
    const prompt = promptResult.fullPrompt

    // 決定使用哪個提供商
    const useFlux = provider === 'flux' || (provider === 'auto' && process.env.FAL_KEY)
    const useDalle = provider === 'dalle' || !useFlux

    // 嘗試 Flux（更便宜：$0.008/張）
    if (useFlux) {
      console.log('→ Step 2: Generating cover image with Flux (fal.ai)...')
      console.log(`   Cost: ~$0.008 per image`)

      const fluxPrompt = buildFluxPrompt(promptResult.subject, brands?.[0])
      const fluxResult = await generateWithFlux(fluxPrompt)

      if (fluxResult && fluxResult.url && !fluxResult.error) {
        console.log('✓ Flux image generated successfully')
        return {
          url: fluxResult.url,
          revisedPrompt: fluxPrompt,
          provider: 'flux',
          cost: 0.008
        }
      }

      // Flux 失敗，如果是 auto 模式則 fallback 到 DALL-E
      if (provider === 'auto') {
        console.log('⚠ Flux failed, falling back to DALL-E 3...')
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
      console.log('→ Step 2: Generating cover image with DALL-E 3...')
      console.log(`   Cost: ~$0.04 per image`)
      console.log(`   Prompt: ${prompt.slice(0, 100)}...`)

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
        console.error('✗ DALL-E 3 returned no image URL')
        return null
      }

      console.log('✓ DALL-E 3 image generated successfully')
      console.log(`   URL: ${imageUrl.slice(0, 60)}...`)

      return {
        url: imageUrl,
        revisedPrompt,
        provider: 'dalle',
        cost: 0.04
      }
    }

    return null

  } catch (error) {
    console.error('✗ Image generation failed:', getErrorMessage(error))
    return {
      url: '',
      error: getErrorMessage(error)
    }
  }
}

/**
 * 分析文章內容，提取視覺關鍵詞
 */
function analyzeContentForVisuals(title: string, content: string): string {
  const contentPreview = content.slice(0, 500)
  const combined = `${title}. ${contentPreview}`.toLowerCase()

  const visualElements: string[] = []

  // 技術特徵
  if (combined.includes('電動') || combined.includes('ev') || combined.includes('electric')) {
    visualElements.push('showcasing electric vehicle charging port or EV badge')
  }
  if (combined.includes('氫') || combined.includes('hydrogen')) {
    visualElements.push('highlighting hydrogen fuel cell technology elements')
  }
  if (combined.includes('自動駕駛') || combined.includes('autonomous') || combined.includes('self-driving')) {
    visualElements.push('emphasizing autonomous driving sensors and cameras on the vehicle')
  }
  if (combined.includes('混合動力') || combined.includes('hybrid')) {
    visualElements.push('showing hybrid badging or blue eco-friendly accents')
  }

  // 車輛類型
  if (combined.includes('suv')) {
    visualElements.push('SUV body style with elevated ride height')
  } else if (combined.includes('轎車') || combined.includes('sedan')) {
    visualElements.push('sedan body style with sleek profile')
  } else if (combined.includes('跑車') || combined.includes('sports')) {
    visualElements.push('sports car with aggressive stance and low profile')
  } else if (combined.includes('皮卡') || combined.includes('truck')) {
    visualElements.push('pickup truck with cargo bed visible')
  }

  // 設計元素
  if (combined.includes('新設計') || combined.includes('改款') || combined.includes('facelift')) {
    visualElements.push('highlighting updated front grille and headlight design')
  }
  if (combined.includes('內裝') || combined.includes('interior')) {
    visualElements.push('interior shot showing dashboard, seats, and center console')
  }
  if (combined.includes('螢幕') || combined.includes('display') || combined.includes('屏幕')) {
    visualElements.push('featuring large touchscreen display')
  }

  // 性能相關
  if (combined.includes('性能') || combined.includes('performance') || combined.includes('馬力')) {
    visualElements.push('dynamic action shot suggesting speed and performance')
  }
  if (combined.includes('越野') || combined.includes('off-road')) {
    visualElements.push('off-road setting with rugged terrain')
  }

  // 事件類型
  if (combined.includes('發表') || combined.includes('推出') || combined.includes('debut') || combined.includes('launch')) {
    visualElements.push('dramatic reveal presentation setting or auto show environment')
  }
  if (combined.includes('測試') || combined.includes('test')) {
    visualElements.push('testing environment or track setting')
  }
  if (combined.includes('量產') || combined.includes('production')) {
    visualElements.push('production-ready vehicle in studio setting')
  }

  // 顏色提示
  if (combined.includes('白色') || combined.includes('white')) {
    visualElements.push('white or pearl white exterior color')
  } else if (combined.includes('黑色') || combined.includes('black')) {
    visualElements.push('black or midnight black exterior color')
  } else if (combined.includes('藍色') || combined.includes('blue')) {
    visualElements.push('blue metallic exterior color')
  } else if (combined.includes('紅色') || combined.includes('red')) {
    visualElements.push('red or crimson exterior color')
  }

  return visualElements.length > 0
    ? visualElements.join(', ')
    : 'modern design with clean lines and contemporary styling'
}

/**
 * 構建圖片生成提示詞
 * 優化以生成更逼真、更少 AI 痕跡的圖片
 */
function buildImagePrompt(
  title: string,
  content: string,
  brands?: string[]
): string {
  // 分析內容提取視覺關鍵詞
  const visualContext = analyzeContentForVisuals(title, content)

  // 基礎提示詞 - 強調真實攝影感
  let prompt = `IMPORTANT: Create a hyper-realistic photograph that looks like it was taken by a professional automotive photographer with a high-end DSLR camera. `
  prompt += `This must look like a real photograph, NOT a 3D render or AI-generated image. `

  // 品牌信息
  if (brands && brands.length > 0) {
    const brandName = brands[0]
    prompt += `Subject: ${brandName} vehicle. `
  } else {
    prompt += `Subject: Modern luxury automobile. `
  }

  // 場景描述 - 基於標題和內容分析
  prompt += `Article context: ${title}. `
  prompt += `Visual elements to emphasize: ${visualContext}. `

  // 攝影技術細節 - 讓圖片更真實
  prompt += `Photography specs: `
  prompt += `Shot with Canon EOS R5 or Sony A7R IV. `
  prompt += `85mm f/1.4 lens for portrait shots or 24-70mm f/2.8 for wide angles. `
  prompt += `Natural lighting with subtle reflections. `
  prompt += `Shallow depth of field (f/2.8-f/4) with natural bokeh. `
  prompt += `ISO 100-400 for clean, noise-free image. `

  // 環境和光線
  prompt += `Setting: `
  prompt += `Professional studio with controlled lighting OR outdoor location with golden hour lighting. `
  prompt += `Clean, uncluttered background. `
  prompt += `Subtle environmental reflections on car surface. `
  prompt += `Natural shadows and highlights. `

  // 細節要求 - 避免 AI 痕跡
  prompt += `Critical details: `
  prompt += `Perfect panel gaps and body alignment. `
  prompt += `Realistic tire tread and wheel details. `
  prompt += `Accurate brand-specific design elements. `
  prompt += `Natural wear on surfaces (subtle dust, realistic reflections). `
  prompt += `Correct perspective and proportions. `
  prompt += `No distorted text or logos. `
  prompt += `No impossible reflections or physics. `
  prompt += `No overly smooth or plastic-looking surfaces. `

  // 後期處理風格
  prompt += `Post-processing: `
  prompt += `Subtle color grading like professional automotive photography. `
  prompt += `Natural contrast, not over-saturated. `
  prompt += `Slight vignette if appropriate. `
  prompt += `Film grain texture for authenticity (very subtle). `

  // 禁止元素
  prompt += `AVOID: `
  prompt += `No text, watermarks, logos, or captions. `
  prompt += `No overly perfect symmetry. `
  prompt += `No obvious 3D render look. `
  prompt += `No unnatural lighting or impossible reflections. `
  prompt += `No distorted wheels or panels. `

  // DALL-E 3 有 4000 字符限制
  return prompt.slice(0, 3900)
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

  // 策略 1: 如果有參考圖片，優先使用圖生圖（Image Variation）
  if (referenceImages && referenceImages.length > 0) {
    console.log(`→ Found ${referenceImages.length} reference images, trying variation generation first...`)

    try {
      const { generateCoverFromBestReference } = await import('@/lib/ai/image-variation')
      const variationResult = await generateCoverFromBestReference(referenceImages)

      if (variationResult && variationResult.url) {
        console.log('✓ Successfully generated cover from reference image')
        return variationResult
      } else {
        console.log('⚠ Variation generation failed, falling back to text-to-image...')
      }
    } catch (error) {
      console.warn('⚠ Variation generation error:', getErrorMessage(error))
      console.log('→ Falling back to text-to-image generation...')
    }
  }

  // 策略 2: Fallback 到純文字生成（優先 Flux，備選 DALL-E 3）
  console.log('→ Using text-to-image generation (Flux preferred, DALL-E 3 fallback)...')

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

  console.log('→ Uploading AI-generated image to permanent storage...')
  const permanentUrl = await uploadImageFromUrl(result.url, fileName, true)

  // 根據使用的提供商設定 credit
  const providerName = result.provider === 'flux' ? 'Flux' : 'DALL-E 3'
  const costInfo = result.cost ? ` ($${result.cost.toFixed(3)})` : ''

  if (!permanentUrl) {
    console.warn('⚠ Failed to upload to storage, using temporary URL')
    return {
      url: result.url,
      credit: `AI 生成示意圖 (${providerName})${costInfo} - Temporary URL`
    }
  }

  console.log(`✓ Image saved to permanent storage (provider: ${providerName}, cost: ${costInfo})`)
  return {
    url: permanentUrl,
    credit: `AI 生成示意圖 (${providerName})`
  }
}
