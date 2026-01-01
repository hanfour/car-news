/**
 * 圖片上傳工具
 * 將遠端圖片下載並上傳到 Supabase Storage
 */

import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'
import { getErrorMessage } from '@/lib/utils/error'

const BUCKET_NAME = 'article-images'

/**
 * 確保 Storage Bucket 存在
 */
async function ensureBucketExists() {
  const supabase = createServiceClient()

  // 檢查 bucket 是否存在
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)

  if (!bucketExists) {
    console.log(`Creating storage bucket: ${BUCKET_NAME}`)
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true, // 公開訪問
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
    })

    if (error) {
      console.error('Failed to create bucket:', error)
      return false
    }
  }

  return true
}

/**
 * 從 URL 下載圖片並上傳到 Supabase Storage
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  fileName?: string,
  addWatermark?: boolean
): Promise<string | null> {
  try {
    // 1. 確保 bucket 存在
    const bucketReady = await ensureBucketExists()
    if (!bucketReady) {
      console.error('Storage bucket not ready')
      return null
    }

    // 2. 下載圖片
    console.log(`→ Downloading image from: ${imageUrl.slice(0, 60)}...`)
    const response = await fetch(imageUrl)

    if (!response.ok) {
      console.error(`✗ Failed to download image: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    let buffer: Buffer = Buffer.from(arrayBuffer)

    // 2.1 如果需要添加浮水印（使用英文避免 Vercel 無中文字體問題）
    if (addWatermark) {
      console.log('→ Adding AI watermark...')
      const { addWatermark: addWatermarkFn } = await import('@/lib/utils/watermark')
      buffer = await addWatermarkFn(buffer, {
        text: 'AI Generated',
        subText: 'For illustration only',
        position: 'bottom-right',
        opacity: 0.6,
        fontSize: 36
      })
    }

    // 2.2 優化和轉換圖片為 WebP 格式
    console.log('→ Optimizing and converting to WebP...')
    const sharp = (await import('sharp')).default
    buffer = await sharp(buffer)
      .resize(1792, 1024, {
        fit: 'inside', // 保持比例，不超過指定尺寸
        withoutEnlargement: true // 不放大小圖片
      })
      .webp({
        quality: 85, // 高質量 WebP（平衡質量和大小）
        effort: 6 // 壓縮努力程度（0-6，6最慢但壓縮最好）
      })
      .toBuffer()

    console.log('✓ Image optimized and converted to WebP')

    // 3. 生成唯一文件名（使用 .webp 擴展名）
    const extension = 'webp'
    const contentType = 'image/webp'

    const hash = crypto.createHash('md5').update(buffer).digest('hex')
    const finalFileName = fileName
      ? `${fileName}.${extension}`
      : `${Date.now()}-${hash.slice(0, 8)}.${extension}`

    // 4. 上傳到 Supabase Storage
    console.log(`→ Uploading to storage: ${finalFileName}`)
    const supabase = createServiceClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(finalFileName, buffer, {
        contentType,
        upsert: true // 如果文件存在則覆蓋
      })

    if (error) {
      console.error('✗ Upload failed:', error.message)
      return null
    }

    // 5. 獲取公開 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    const publicUrl = publicUrlData.publicUrl

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
    const supabase = createServiceClient()

    // 列出所有文件
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list()

    if (listError || !files) {
      console.error('Failed to list files:', listError)
      return 0
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const filesToDelete = files
      .filter(file => new Date(file.created_at) < cutoffDate)
      .map(file => file.name)

    if (filesToDelete.length === 0) {
      console.log('No old images to delete')
      return 0
    }

    // 批量刪除
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete)

    if (deleteError) {
      console.error('Failed to delete files:', deleteError)
      return 0
    }

    console.log(`✓ Deleted ${filesToDelete.length} old images`)
    return filesToDelete.length

  } catch (error) {
    console.error('Delete error:', getErrorMessage(error))
    return 0
  }
}
