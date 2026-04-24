/**
 * 圖片上傳工具
 * 將遠端圖片下載並上傳到 Cloudflare R2
 */

import crypto from 'crypto'
import { getErrorMessage } from '@/lib/utils/error'
import { uploadToR2, listR2Objects, deleteFromR2 } from './r2-client'
import { logger } from '@/lib/logger'

/**
 * 從 URL 下載圖片並上傳到 R2
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  fileName?: string,
  addWatermark?: boolean
): Promise<string | null> {
  try {
    // 1. 下載圖片
    logger.info('storage.image.download_start', { url: imageUrl.slice(0, 120) })
    const response = await fetch(imageUrl)

    if (!response.ok) {
      logger.error('storage.image.download_fail', null, {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl.slice(0, 120),
      })
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    let buffer: Buffer = Buffer.from(arrayBuffer)

    // 浮水印功能已停用
    if (addWatermark) {
      logger.info('storage.image.watermark_skipped', { reason: 'no font support on Vercel serverless' })
    }

    // 2. 優化和轉換圖片為 WebP 格式
    logger.info('storage.image.optimize_start')
    const sharp = (await import('sharp')).default
    buffer = await sharp(buffer)
      .resize(1792, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({
        quality: 85,
        effort: 6
      })
      .toBuffer()

    logger.info('storage.image.optimize_done')

    // 3. 生成唯一文件名
    const hash = crypto.createHash('md5').update(buffer).digest('hex')
    const finalFileName = fileName
      ? `${fileName}.webp`
      : `${Date.now()}-${hash.slice(0, 8)}.webp`

    // 4. 上傳到 R2
    logger.info('storage.image.upload_start', { fileName: finalFileName })
    const publicUrl = await uploadToR2(finalFileName, buffer, 'image/webp')

    logger.info('storage.image.upload_success', { fileName: finalFileName, urlPreview: publicUrl.slice(0, 120) })

    return publicUrl

  } catch (error) {
    logger.error('storage.image.upload_fail', error, { reason: getErrorMessage(error) })
    return null
  }
}

/**
 * 批量上傳多張圖片
 */
export async function uploadMultipleImages(
  imageUrls: string[]
): Promise<Array<{ original: string; uploaded: string | null }>> {
  const results = []

  for (const url of imageUrls) {
    const uploadedUrl = await uploadImageFromUrl(url)
    results.push({
      original: url,
      uploaded: uploadedUrl
    })
  }

  return results
}

/**
 * 刪除舊圖片（清理用）
 */
export async function deleteOldImages(olderThanDays: number = 30): Promise<number> {
  try {
    const objects = await listR2Objects()

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const toDelete = objects.filter(obj =>
      obj.lastModified && obj.lastModified < cutoffDate
    )

    if (toDelete.length === 0) {
      logger.info('storage.image.cleanup_none')
      return 0
    }

    for (const obj of toDelete) {
      await deleteFromR2(obj.key)
    }

    logger.info('storage.image.cleanup_done', { deleted: toDelete.length })
    return toDelete.length

  } catch (error) {
    logger.error('storage.image.cleanup_fail', error, { reason: getErrorMessage(error) })
    return 0
  }
}
