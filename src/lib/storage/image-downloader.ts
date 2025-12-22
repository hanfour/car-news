import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'
import { getErrorMessage } from '@/lib/utils/error'

/**
 * 圖片下載和存儲服務
 *
 * 功能：
 * 1. 從外部 URL 下載圖片
 * 2. 上傳到 Supabase Storage
 * 3. 返回公開訪問 URL
 *
 * 優勢：
 * - 避免外部圖片失效（404）
 * - 提升加載速度（CDN 加速）
 * - 完整控制圖片生命週期
 * - 支持 SEO 優化
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
  // 使用 URL 的 hash 確保相同圖片不會重複上傳
  const urlHash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8)

  // 提取文件擴展名
  const urlWithoutQuery = url.split('?')[0]
  const ext = urlWithoutQuery.split('.').pop()?.toLowerCase() || 'jpg'

  // 只允許常見圖片格式
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const finalExt = allowedExts.includes(ext) ? ext : 'jpg'

  // 格式：{articleId}-{timestamp}-{hash}.{ext}
  return `${articleId}/${Date.now()}-${urlHash}.${finalExt}`
}

/**
 * 嘗試將圖片 URL 轉換為壓縮版本
 */
function tryCompressUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    // The Verge / Vox Media 圖片服務
    if (urlObj.hostname.includes('theverge.com') || urlObj.hostname.includes('vox-cdn.com')) {
      // 將 quality=90 降低到 quality=60，並限制寬度
      urlObj.searchParams.set('quality', '60')
      urlObj.searchParams.set('w', '1200')
      return urlObj.toString()
    }

    // Electrek 圖片服務
    if (urlObj.hostname.includes('electrek.co')) {
      urlObj.searchParams.set('quality', '70')
      urlObj.searchParams.set('w', '1200')
      return urlObj.toString()
    }

    // Autocar 圖片服務
    if (urlObj.hostname.includes('autocar.co.uk')) {
      // 如果有 itok 參數，移除並添加壓縮參數
      urlObj.searchParams.delete('itok')
      return urlObj.toString()
    }

    // 通用降級：如果有 quality 參數，降低它
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
 * 下載圖片並存儲到 Supabase Storage
 *
 * @param imageUrl 外部圖片 URL
 * @param articleId 文章 ID（用於組織文件結構）
 * @param credit 圖片來源標註
 * @returns 存儲後的圖片信息，失敗返回 null
 */
export async function downloadAndStoreImage(
  imageUrl: string,
  articleId: string,
  credit: string = 'Unknown'
): Promise<StoredImage | null> {
  try {
    console.log(`[Image Storage] Downloading: ${imageUrl}`)

    // 1. 下載圖片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)',
      },
      signal: AbortSignal.timeout(30000), // 30秒超時
    })

    if (!response.ok) {
      console.error(`[Image Storage] Download failed: ${response.status} ${response.statusText}`)
      return null
    }

    // 檢查是否為圖片
    const contentType = response.headers.get('content-type')
    if (!contentType?.startsWith('image/')) {
      console.error(`[Image Storage] Invalid content type: ${contentType}`)
      return null
    }

    // 2. 轉換為 Blob
    const blob = await response.blob()
    const size = blob.size

    console.log(`[Image Storage] Downloaded ${size} bytes, type: ${contentType}`)

    // 檢查圖片是否過小 (可能是縮圖或佔位符)
    if (size < 5000) {
      console.warn(`[Image Storage] Image too small (${size} bytes), likely a placeholder or thumbnail`)
      console.warn(`[Image Storage] Skipping image: ${imageUrl}`)
      return null
    }

    // 檢查文件大小（限制 10MB）
    if (size > 10 * 1024 * 1024) {
      console.warn(`[Image Storage] File too large (${size} bytes), attempting to fetch compressed version...`)

      // 嘗試從 URL 參數降低品質
      const compressedUrl = tryCompressUrl(imageUrl)
      if (compressedUrl !== imageUrl) {
        console.log(`[Image Storage] Retrying with compressed URL: ${compressedUrl}`)
        return downloadAndStoreImage(compressedUrl, articleId, credit)
      }

      console.error(`[Image Storage] File too large after compression attempt: ${size} bytes`)
      return null
    }

    // 3. 生成文件名
    const filename = generateFilename(imageUrl, articleId)

    // 4. 上傳到 Supabase Storage
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage
      .from('article-images')
      .upload(filename, blob, {
        contentType: blob.type,
        cacheControl: '31536000', // 1 year
        upsert: false, // 不覆蓋已存在的文件
      })

    if (error) {
      console.error(`[Image Storage] Upload failed:`, error)
      return null
    }

    // 5. 獲取公開 URL
    const { data: { publicUrl } } = supabase.storage
      .from('article-images')
      .getPublicUrl(filename)

    console.log(`[Image Storage] ✓ Stored successfully: ${publicUrl}`)

    return {
      url: publicUrl,
      credit,
      originalUrl: imageUrl,
      size,
      mimeType: blob.type,
    }
  } catch (error) {
    console.error(`[Image Storage] Error:`, getErrorMessage(error))
    return null
  }
}

/**
 * 批量下載和存儲圖片
 *
 * @param images 圖片列表 {url, credit}
 * @param articleId 文章 ID
 * @returns 成功存儲的圖片列表
 */
export async function downloadAndStoreImages(
  images: Array<{ url: string; credit: string; caption?: string }>,
  articleId: string
): Promise<Array<{ url: string; credit: string; caption?: string }>> {
  const results: Array<{ url: string; credit: string; caption?: string }> = []

  for (const image of images) {
    const stored = await downloadAndStoreImage(image.url, articleId, image.credit)

    if (stored) {
      results.push({
        url: stored.url,
        credit: stored.credit,
        caption: image.caption,
      })
    } else {
      // 如果下載失敗（例如 403 Forbidden），跳過這張圖片
      // 不使用原 URL 作為 fallback，因為用戶端也無法訪問
      console.warn(`[Image Storage] Skipping image (download failed): ${image.url}`)
    }
  }

  return results
}
