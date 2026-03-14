/**
 * 圖片上傳工具
 * 將遠端圖片下載並上傳到 Cloudflare R2
 */

import crypto from 'crypto'
import { getErrorMessage } from '@/lib/utils/error'
import { uploadToR2, listR2Objects, deleteFromR2 } from './r2-client'

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
    console.log(`→ Downloading image from: ${imageUrl.slice(0, 60)}...`)
    const response = await fetch(imageUrl)

    if (!response.ok) {
      console.error(`✗ Failed to download image: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    let buffer: Buffer = Buffer.from(arrayBuffer)

    // 浮水印功能已停用
    if (addWatermark) {
      console.log('→ Watermark disabled (no font support on Vercel serverless)')
    }

    // 2. 優化和轉換圖片為 WebP 格式
    console.log('→ Optimizing and converting to WebP...')
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

    console.log('✓ Image optimized and converted to WebP')

    // 3. 生成唯一文件名
    const hash = crypto.createHash('md5').update(buffer).digest('hex')
    const finalFileName = fileName
      ? `${fileName}.webp`
      : `${Date.now()}-${hash.slice(0, 8)}.webp`

    // 4. 上傳到 R2
    console.log(`→ Uploading to R2: ${finalFileName}`)
    const publicUrl = await uploadToR2(finalFileName, buffer, 'image/webp')

    console.log(`✓ Image uploaded successfully`)
    console.log(`   Public URL: ${publicUrl.slice(0, 60)}...`)

    return publicUrl

  } catch (error) {
    console.error('✗ Image upload error:', getErrorMessage(error))
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
      console.log('No old images to delete')
      return 0
    }

    for (const obj of toDelete) {
      await deleteFromR2(obj.key)
    }

    console.log(`✓ Deleted ${toDelete.length} old images`)
    return toDelete.length

  } catch (error) {
    console.error('Delete error:', getErrorMessage(error))
    return 0
  }
}
