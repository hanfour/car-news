import { createServiceClient } from '@/lib/supabase'
import { downloadAndStoreImage, downloadAndStoreImages } from '@/lib/storage/image-downloader'
import { NextResponse } from 'next/server'

/**
 * 圖片遷移 API - 將歷史文章的外部圖片下載並存儲到 Supabase Storage
 *
 * 功能：
 * 1. 掃描所有文章的圖片 URL
 * 2. 下載外部圖片並存儲到 Supabase Storage
 * 3. 更新資料庫記錄
 *
 * 執行方式：
 * curl -X POST https://wantcar.vercel.app/api/admin/migrate-images
 */
export async function POST() {
  const startTime = Date.now()

  try {
    const supabase = createServiceClient()

    // 統計結果
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      coverImagesMigrated: 0,
      imagesArrayMigrated: 0,
      details: [] as Array<{
        id: string
        title: string
        coverImageMigrated: boolean
        imagesCount: number
        error?: string
      }>
    }

    // 1. 獲取所有文章
    console.log('[Image Migration] Fetching all articles...')
    const { data: articles, error: fetchError } = await supabase
      .from('generated_articles')
      .select('id, title_zh, cover_image, images')
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw new Error(`Failed to fetch articles: ${fetchError.message}`)
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles to migrate',
        results
      })
    }

    results.total = articles.length
    console.log(`[Image Migration] Found ${articles.length} articles to process`)

    // 2. 處理每篇文章
    for (const article of articles) {
      console.log(`\n[Image Migration] Processing article: ${article.id}`)

      try {
        let migrated = false
        let newCoverImage = article.cover_image
        let newImages = article.images

        // 2.1 處理封面圖片
        if (article.cover_image && isExternalUrl(article.cover_image)) {
          console.log(`[Image Migration] → Migrating cover image...`)

          const stored = await downloadAndStoreImage(
            article.cover_image,
            article.id,
            'Migrated'
          )

          if (stored) {
            newCoverImage = stored.url
            results.coverImagesMigrated++
            migrated = true
            console.log(`[Image Migration] ✓ Cover image migrated`)
          } else {
            console.log(`[Image Migration] ✗ Cover image migration failed, keeping original`)
          }
        }

        // 2.2 處理 images 陣列
        if (Array.isArray(article.images) && article.images.length > 0) {
          console.log(`[Image Migration] → Migrating ${article.images.length} images...`)

          const externalImages = article.images.filter((img: any) =>
            img.url && isExternalUrl(img.url)
          )

          if (externalImages.length > 0) {
            const storedImages = await downloadAndStoreImages(
              externalImages.map((img: any) => ({
                url: img.url,
                credit: img.credit || 'Migrated',
                caption: img.caption
              })),
              article.id
            )

            // 合併已遷移和未遷移的圖片
            const migratedImageUrls = new Set(externalImages.map((img: any) => img.url))
            const unchangedImages = article.images.filter((img: any) =>
              !migratedImageUrls.has(img.url)
            )

            newImages = [...unchangedImages, ...storedImages]
            results.imagesArrayMigrated += storedImages.length
            migrated = true
            console.log(`[Image Migration] ✓ Migrated ${storedImages.length}/${externalImages.length} images`)
          }
        }

        // 2.3 更新資料庫（如果有變更）
        if (migrated) {
          const { error: updateError } = await supabase
            .from('generated_articles')
            .update({
              cover_image: newCoverImage,
              images: newImages
            })
            .eq('id', article.id)

          if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`)
          }

          results.success++
          console.log(`[Image Migration] ✓ Article ${article.id} updated successfully`)
        } else {
          console.log(`[Image Migration] → No migration needed for article ${article.id}`)
          results.success++
        }

        results.details.push({
          id: article.id,
          title: article.title_zh || 'Untitled',
          coverImageMigrated: newCoverImage !== article.cover_image,
          imagesCount: Array.isArray(newImages) ? newImages.length : 0
        })

      } catch (error: any) {
        console.error(`[Image Migration] ✗ Error processing article ${article.id}:`, error.message)
        results.failed++
        results.details.push({
          id: article.id,
          title: article.title_zh || 'Untitled',
          coverImageMigrated: false,
          imagesCount: 0,
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime

    console.log(`\n[Image Migration] Complete!`)
    console.log(`  Total: ${results.total}`)
    console.log(`  Success: ${results.success}`)
    console.log(`  Failed: ${results.failed}`)
    console.log(`  Cover images migrated: ${results.coverImagesMigrated}`)
    console.log(`  Images array items migrated: ${results.imagesArrayMigrated}`)
    console.log(`  Duration: ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      results,
      summary: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        coverImagesMigrated: results.coverImagesMigrated,
        imagesArrayMigrated: results.imagesArrayMigrated
      }
    })

  } catch (error: any) {
    console.error('[Image Migration] Fatal error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

/**
 * 檢查 URL 是否為外部 URL（需要遷移）
 */
function isExternalUrl(url: string): boolean {
  // Supabase Storage URLs 不需要遷移
  if (url.includes('.supabase.co/storage/') || url.includes('.supabase.in/storage/')) {
    return false
  }

  // 其他所有外部 URL 都需要遷移
  return url.startsWith('http://') || url.startsWith('https://')
}
