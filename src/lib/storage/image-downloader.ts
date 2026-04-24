import crypto from 'crypto'
import { getErrorMessage } from '@/lib/utils/error'
import { isLegalImageSource, getImageSourceCredit } from '@/config/image-sources'
import { uploadToR2 } from './r2-client'
import { logger } from '@/lib/logger'

/**
 * 圖片下載和存儲服務
 *
 * ⚠️ 法律合規版本 - 2024/12 更新
 *
 * 重要變更：
 * - 只下載來自官方 Newsroom 的合法圖片
 * - 非官方來源的圖片將被跳過，改用 AI 生成
 * - 所有圖片必須標註來源
 *
 * 合法來源：
 * 1. 官方品牌 Newsroom / Media Center
 * 2. 已授權的圖片服務 (CDN)
 * 3. AI 生成圖片
 *
 * 禁止來源：
 * - 私人網站 / 部落格
 * - 未授權的新聞媒體圖片
 * - 社群媒體直連圖片（應使用嵌入）
 */

export interface StoredImage {
  url: string
  credit: string
  originalUrl: string
  size?: number
  mimeType?: string
}

/**
 * 從 URL 生成唯一的文件名
 */
function generateFilename(url: string, articleId: string): string {
  const urlHash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8)
  const urlWithoutQuery = url.split('?')[0]
  const ext = urlWithoutQuery.split('.').pop()?.toLowerCase() || 'jpg'
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const finalExt = allowedExts.includes(ext) ? ext : 'jpg'

  return `${articleId}/${Date.now()}-${urlHash}.${finalExt}`
}

/**
 * 嘗試將圖片 URL 轉換為壓縮版本
 */
function tryCompressUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    if (urlObj.hostname.includes('theverge.com') || urlObj.hostname.includes('vox-cdn.com')) {
      urlObj.searchParams.set('quality', '60')
      urlObj.searchParams.set('w', '1200')
      return urlObj.toString()
    }

    if (urlObj.hostname.includes('electrek.co')) {
      urlObj.searchParams.set('quality', '70')
      urlObj.searchParams.set('w', '1200')
      return urlObj.toString()
    }

    if (urlObj.hostname.includes('autocar.co.uk')) {
      urlObj.searchParams.delete('itok')
      return urlObj.toString()
    }

    if (urlObj.searchParams.has('quality')) {
      const currentQuality = parseInt(urlObj.searchParams.get('quality') || '90')
      urlObj.searchParams.set('quality', Math.min(60, currentQuality - 20).toString())
      return urlObj.toString()
    }

    return url
  } catch {
    return url
  }
}

/**
 * 下載圖片並存儲到 Cloudflare R2
 *
 * ⚠️ 法律合規版本：只處理合法來源的圖片
 */
export async function downloadAndStoreImage(
  imageUrl: string,
  articleId: string,
  credit: string = 'Unknown'
): Promise<StoredImage | null> {
  try {
    // ⚠️ 法律合規檢查
    const sourceCheck = isLegalImageSource(imageUrl)

    if (!sourceCheck.isLegal) {
      logger.warn('storage.image.illegal_source', {
        domain: sourceCheck.domain,
        url: imageUrl,
        suggestion: 'use_ai_generated',
      })
      return null
    }

    const legalCredit = getImageSourceCredit(imageUrl)
    logger.info('storage.image.legal_source', {
      source: sourceCheck.source,
      domain: sourceCheck.domain,
      url: imageUrl,
    })

    // 1. 下載圖片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      logger.error('storage.image.download_fail', null, {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl,
      })
      return null
    }

    const contentType = response.headers.get('content-type')
    if (!contentType?.startsWith('image/')) {
      logger.error('storage.image.invalid_content_type', null, { contentType, url: imageUrl })
      return null
    }

    // 2. 轉換為 Buffer
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const size = buffer.length

    logger.info('storage.image.download_done', { size, contentType })

    if (size < 5000) {
      logger.warn('storage.image.too_small', { size, url: imageUrl })
      return null
    }

    if (size > 10 * 1024 * 1024) {
      logger.warn('storage.image.too_large', { size, url: imageUrl })

      const compressedUrl = tryCompressUrl(imageUrl)
      if (compressedUrl !== imageUrl) {
        logger.info('storage.image.retry_compressed', { compressedUrl })
        return downloadAndStoreImage(compressedUrl, articleId, credit)
      }

      logger.error('storage.image.too_large_after_compress', null, { size, url: imageUrl })
      return null
    }

    // 3. 生成文件名並上傳到 R2
    const filename = generateFilename(imageUrl, articleId)
    const publicUrl = await uploadToR2(filename, buffer, contentType)

    logger.info('storage.image.store_success', { publicUrl })

    return {
      url: publicUrl,
      credit: legalCredit,
      originalUrl: imageUrl,
      size,
      mimeType: contentType,
    }
  } catch (error) {
    logger.error('storage.image.error', error, { reason: getErrorMessage(error), url: imageUrl })
    return null
  }
}

/**
 * 批量下載和存儲圖片
 */
export async function downloadAndStoreImages(
  images: Array<{ url: string; credit: string; caption?: string }>,
  articleId: string
): Promise<Array<{ url: string; credit: string; caption?: string }>> {
  const results: Array<{ url: string; credit: string; caption?: string }> = []
  const CHUNK_SIZE = 3

  for (let i = 0; i < images.length; i += CHUNK_SIZE) {
    const chunk = images.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.allSettled(
      chunk.map(image => downloadAndStoreImage(image.url, articleId, image.credit))
    )

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j]
      if (result.status === 'fulfilled' && result.value) {
        results.push({
          url: result.value.url,
          credit: result.value.credit,
          caption: chunk[j].caption,
        })
      } else {
        logger.warn('storage.image.skip_failed', { url: chunk[j].url })
      }
    }
  }

  return results
}
