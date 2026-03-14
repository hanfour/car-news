import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { uploadToR2 } from '@/lib/storage/r2-client'

export const maxDuration = 300

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

/**
 * POST /api/admin/migrate-to-r2
 * 將 Supabase Storage 中的圖片遷移到 Cloudflare R2
 */
export async function POST(request: NextRequest) {
  // 驗證身份
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const BATCH_SIZE = 10

  try {
    // 查詢含有 supabase storage URL 的文章
    const { data: articles, error } = await supabase
      .from('generated_articles')
      .select('id, cover_image, images')
      .or('cover_image.ilike.%supabase.co/storage%,images::text.ilike.%supabase.co/storage%')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({ message: 'No articles to migrate', migrated: 0 })
    }

    console.log(`[Migration] Found ${articles.length} articles with Supabase Storage URLs`)

    let migratedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // 分批處理
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)
      console.log(`[Migration] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)}`)

      for (const article of batch) {
        try {
          const updates: Record<string, unknown> = {}

          // 遷移 cover_image
          if (article.cover_image && article.cover_image.includes('supabase.co/storage')) {
            const newUrl = await migrateImageUrl(article.cover_image)
            if (newUrl) {
              updates.cover_image = newUrl
            }
          }

          // 遷移 images 陣列
          if (article.images && Array.isArray(article.images)) {
            const migratedImages = []
            let hasChanges = false

            for (const img of article.images) {
              if (typeof img === 'object' && img.url && img.url.includes('supabase.co/storage')) {
                const newUrl = await migrateImageUrl(img.url)
                if (newUrl) {
                  migratedImages.push({ ...img, url: newUrl })
                  hasChanges = true
                } else {
                  migratedImages.push(img)
                }
              } else if (typeof img === 'string' && img.includes('supabase.co/storage')) {
                const newUrl = await migrateImageUrl(img)
                migratedImages.push(newUrl || img)
                if (newUrl) hasChanges = true
              } else {
                migratedImages.push(img)
              }
            }

            if (hasChanges) {
              updates.images = migratedImages
            }
          }

          // 更新資料庫
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('generated_articles')
              .update(updates)
              .eq('id', article.id)

            if (updateError) {
              console.error(`[Migration] Failed to update article ${article.id}:`, updateError.message)
              errors.push(`Article ${article.id}: ${updateError.message}`)
              errorCount++
            } else {
              migratedCount++
              console.log(`[Migration] ✓ Article ${article.id} migrated`)
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[Migration] Error processing article ${article.id}:`, msg)
          errors.push(`Article ${article.id}: ${msg}`)
          errorCount++
        }
      }
    }

    return NextResponse.json({
      message: 'Migration completed',
      total: articles.length,
      migrated: migratedCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error('[Migration] Fatal error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 下載圖片並上傳到 R2，回傳新 URL
 */
async function migrateImageUrl(oldUrl: string): Promise<string | null> {
  try {
    console.log(`[Migration] Downloading: ${oldUrl.slice(0, 80)}...`)

    const response = await fetch(oldUrl, {
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[Migration] Download failed: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/webp'
    const buffer = Buffer.from(await response.arrayBuffer())

    // 從舊 URL 提取 key
    const urlPath = new URL(oldUrl).pathname
    // 格式: /storage/v1/object/public/article-images/xxx.webp
    const parts = urlPath.split('/')
    const key = parts[parts.length - 1] || `migrated-${Date.now()}.webp`

    const newUrl = await uploadToR2(key, buffer, contentType)
    console.log(`[Migration] ✓ Uploaded to R2: ${newUrl.slice(0, 80)}...`)

    return newUrl
  } catch (error) {
    console.error(`[Migration] Failed to migrate: ${oldUrl}`, error)
    return null
  }
}
