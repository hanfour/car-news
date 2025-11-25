/**
 * AI 圖片變體生成工具
 * 基於參考圖片生成變體，保持車輛外觀一致性
 */

import OpenAI from 'openai'
import sharp from 'sharp'

// Lazy initialization
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

interface ImageVariationResult {
  url: string
  error?: string
}

/**
 * 下載並處理圖片為 PNG 格式（DALL-E 要求）
 */
async function downloadAndConvertToPNG(imageUrl: string): Promise<Buffer | null> {
  try {
    console.log(`→ Downloading reference image: ${imageUrl.slice(0, 60)}...`)

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`✗ Download failed: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`→ Converting to PNG and resizing...`)

    // 轉換為 PNG 並調整尺寸（DALL-E variations 限制：< 4MB, 正方形）
    const pngBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer()

    const sizeInMB = pngBuffer.length / (1024 * 1024)
    console.log(`✓ Converted to PNG: ${sizeInMB.toFixed(2)} MB`)

    // DALL-E 限制 4MB
    if (pngBuffer.length > 4 * 1024 * 1024) {
      console.warn(`⚠ Image too large (${sizeInMB.toFixed(2)} MB), compressing...`)

      // 進一步壓縮
      const compressed = await sharp(pngBuffer)
        .resize(800, 800, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 80 })
        .toBuffer()

      console.log(`✓ Compressed to ${(compressed.length / (1024 * 1024)).toFixed(2)} MB`)
      return compressed
    }

    return pngBuffer

  } catch (error: any) {
    console.error(`✗ Image processing failed:`, error.message)
    return null
  }
}

/**
 * 基於參考圖片生成變體
 * 使用 DALL-E 2 的 variations API（DALL-E 3 不支持 variations）
 *
 * @param referenceImageUrl 參考圖片 URL
 * @returns 生成的圖片 URL
 */
export async function generateImageVariation(
  referenceImageUrl: string
): Promise<ImageVariationResult | null> {
  try {
    // 1. 下載並處理參考圖片
    const pngBuffer = await downloadAndConvertToPNG(referenceImageUrl)

    if (!pngBuffer) {
      console.error('✗ Failed to process reference image')
      return null
    }

    // 2. 轉換為 File 對象（OpenAI SDK 要求）
    // Convert Buffer to Uint8Array for compatibility
    const uint8Array = new Uint8Array(pngBuffer)
    const blob = new Blob([uint8Array], { type: 'image/png' })
    const file = new File([blob], 'reference.png', { type: 'image/png' })

    console.log('→ Generating image variation with DALL-E 2...')

    // 3. 呼叫 DALL-E 2 variations API
    const response = await getOpenAI().images.createVariation({
      image: file,
      n: 1,
      size: '1024x1024', // DALL-E 2 支持的最大尺寸
      // response_format: 'url', // 默認就是 url
    })

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      console.error('✗ DALL-E 2 returned no image URL')
      return null
    }

    console.log('✓ Variation generated successfully')
    console.log(`   URL: ${imageUrl.slice(0, 60)}...`)

    return {
      url: imageUrl
    }

  } catch (error: any) {
    console.error('✗ Variation generation failed:', error.message)

    // 如果是 quota exceeded 或其他 OpenAI 錯誤，返回錯誤信息
    return {
      url: '',
      error: error.message
    }
  }
}

/**
 * 智能選擇最佳參考圖片並生成封面
 *
 * 策略：
 * 1. 優先選擇包含車輛側面或正面的圖片
 * 2. 選擇尺寸最大的圖片（通常質量更好）
 * 3. 避免選擇價格表、圖表等非車輛圖片
 */
export async function generateCoverFromBestReference(
  images: Array<{ url: string; caption?: string; size?: number }>
): Promise<{ url: string; credit: string } | null> {
  if (!images || images.length === 0) {
    console.log('✗ No reference images available')
    return null
  }

  // 過濾掉明顯不是車輛照片的圖片（但保留較大的圖片）
  const validImages = images.filter(img => {
    const caption = (img.caption || '').toLowerCase()
    const size = img.size || 0

    // 如果圖片很大 (>100KB)，即使是 pricing/compared 也保留（可能包含車輛圖）
    if (size > 100 * 1024) {
      return true
    }

    // 排除小尺寸的價格表、圖表等
    if (caption.includes('pricing') ||
        caption.includes('compared') ||
        caption.includes('chart') ||
        caption.includes('graph') ||
        caption.includes('table')) {
      return false
    }

    return true
  })

  if (validImages.length === 0) {
    console.log('⚠ No valid reference images after filtering, using all images')
    // 如果過濾後沒有圖片，就用全部
    validImages.push(...images)
  }

  // 按尺寸排序，選擇最大的（大圖通常質量更好，包含更多細節）
  const bestImage = validImages.sort((a, b) => (b.size || 0) - (a.size || 0))[0]

  console.log(`→ Selected best reference image:`)
  console.log(`   URL: ${bestImage.url}`)
  console.log(`   Size: ${bestImage.size ? (bestImage.size / 1024).toFixed(1) + ' KB' : 'unknown'}`)
  console.log(`   Caption: ${bestImage.caption || 'N/A'}`)

  // 生成變體
  const variation = await generateImageVariation(bestImage.url)

  if (!variation || !variation.url) {
    return null
  }

  // 上傳到持久化存儲
  const { uploadImageFromUrl } = await import('@/lib/storage/image-uploader')

  const timestamp = Date.now()
  const fileName = `variation-${timestamp}`

  console.log('→ Uploading variation to permanent storage...')
  const permanentUrl = await uploadImageFromUrl(variation.url, fileName, true) // 啟用浮水印

  if (!permanentUrl) {
    console.warn('⚠ Failed to upload to storage, using temporary DALL-E URL')
    return {
      url: variation.url,
      credit: 'AI Generated Variation (DALL-E 2) - Temporary URL'
    }
  }

  console.log('✓ Variation saved to permanent storage')
  return {
    url: permanentUrl,
    credit: 'AI Generated Variation (DALL-E 2)'
  }
}
