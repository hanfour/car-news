import { createServiceClient } from '@/lib/supabase'
import { downloadAndStoreImage, downloadAndStoreImages } from '@/lib/storage/image-downloader'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { ArticleImage } from '@/types/article'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

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
export async function POST(request: NextRequest) {
  const isAuthorized = await verifyAdminAuth(request)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    logger.info('api.admin.migrate_images_fetch_start')
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
    logger.info('api.admin.migrate_images_found', { total: articles.length })

    // 2. 處理每篇文章
    for (const article of articles) {
      logger.info('api.admin.migrate_images_item', { articleId: article.id })

      try {
        let migrated = false
        let newCoverImage = article.cover_image
        let newImages = article.images

        // 2.1 處理封面圖片
        if (article.cover_image && isExternalUrl(article.cover_image)) {
          logger.info('api.admin.migrate_images_cover_start', { articleId: article.id })

          const stored = await downloadAndStoreImage(
            article.cover_image,
            article.id,
            'Migrated'
          )

          if (stored) {
            newCoverImage = stored.url
            results.coverImagesMigrated++
            migrated = true
            logger.info('api.admin.migrate_images_cover_done', { articleId: article.id })
          } else {
            logger.warn('api.admin.migrate_images_cover_fail', { articleId: article.id })
          }
        }

        // 2.2 處理 images 陣列
        if (Array.isArray(article.images) && article.images.length > 0) {
          logger.info('api.admin.migrate_images_array_start', {
            articleId: article.id,
            count: article.images.length,
          })

          const externalImages = article.images.filter((img: ArticleImage) =>
            img.url && isExternalUrl(img.url)
          )

          if (externalImages.length > 0) {
            const storedImages = await downloadAndStoreImages(
              externalImages.map((img: ArticleImage) => ({
                url: img.url,
                credit: img.credit || 'Migrated',
                caption: img.caption
              })),
              article.id
            )

            // 合併已遷移和未遷移的圖片
            const migratedImageUrls = new Set(externalImages.map((img: ArticleImage) => img.url))
            const unchangedImages = article.images.filter((img: ArticleImage) =>
              !migratedImageUrls.has(img.url)
            )

            newImages = [...unchangedImages, ...storedImages]
            results.imagesArrayMigrated += storedImages.length
            migrated = true
            logger.info('api.admin.migrate_images_array_done', {
              articleId: article.id,
              stored: storedImages.length,
              total: externalImages.length,
            })
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
          logger.info('api.admin.migrate_images_article_done', { articleId: article.id })
        } else {
          logger.info('api.admin.migrate_images_skip', { articleId: article.id })
          results.success++
        }

        results.details.push({
          id: article.id,
          title: article.title_zh || 'Untitled',
          coverImageMigrated: newCoverImage !== article.cover_image,
          imagesCount: Array.isArray(newImages) ? newImages.length : 0
        })

      } catch (error) {
        logger.error('api.admin.migrate_images_item_fail', error, {
          articleId: article.id,
          message: getErrorMessage(error),
        })
        results.failed++
        results.details.push({
          id: article.id,
          title: article.title_zh || 'Untitled',
          coverImageMigrated: false,
          imagesCount: 0,
          error: getErrorMessage(error)
        })
      }
    }

    const duration = Date.now() - startTime

    logger.info('api.admin.migrate_images_complete', {
      total: results.total,
      success: results.success,
      failed: results.failed,
      coverImagesMigrated: results.coverImagesMigrated,
      imagesArrayMigrated: results.imagesArrayMigrated,
      durationMs: duration,
    })

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

  } catch (error) {
    logger.error('api.admin.migrate_images_fatal', error, { message: getErrorMessage(error) })

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
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
