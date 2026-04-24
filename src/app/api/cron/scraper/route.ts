import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeAllSources } from '@/lib/scraper'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { getErrorMessage } from '@/lib/utils/error'
import { verifyCronAuth, unauthorized } from '@/lib/cron/auth'
import { logger } from '@/lib/logger'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟（与generator一致）

async function handleCronJob(request: NextRequest) {
  if (!(await verifyCronAuth(request))) {
    return unauthorized()
  }

  const startTime = Date.now()

  try {
    const supabase = createServiceClient()

    // 1. 爬取所有新闻源
    logger.info('cron.scraper.start')
    const articles = await scrapeAllSources()

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new articles found',
        scraped: 0,
        duration: Date.now() - startTime
      })
    }

    const results = []
    let savedCount = 0
    let skippedCount = 0

    // 2. 批次檢查重複（分批處理避免 Supabase 限制）
    const urls = articles.map(a => a.url)
    logger.info('cron.scraper.dedup_check_start', { urlCount: urls.length })

    const existingUrls = new Set<string>()
    const BATCH_SIZE = 100  // Supabase .in() 限制約 100 個

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batchUrls = urls.slice(i, i + BATCH_SIZE)
      const { data: existingArticles, error: checkError } = await supabase
        .from('raw_articles')
        .select('url')
        .in('url', batchUrls)

      if (checkError) {
        logger.error('cron.scraper.dedup_batch_fail', checkError, { batchIndex: i })
      } else if (existingArticles) {
        existingArticles.forEach(a => existingUrls.add(a.url))
      }
    }

    logger.info('cron.scraper.dedup_existing', { existing: existingUrls.size })

    // 3. 準備要保存的文章（過濾重複）
    const articlesToSave = []
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    for (const article of articles) {
      try {
        if (existingUrls.has(article.url)) {
          skippedCount++
          continue
        }

        articlesToSave.push({
          url: article.url,
          title: article.title,
          content: article.content,
          scraped_at: new Date().toISOString(),
          source_published_at: article.publishedAt?.toISOString() || null,
          expires_at: expiresAt,
          embedding: null, // 延遲生成 embedding（generator 中處理）
          image_url: article.imageUrl || null,
          image_credit: article.source || null
        })

        results.push({
          url: article.url,
          title: article.title.slice(0, 100)
        })
      } catch (error) {
        logger.error('cron.scraper.article_process_fail', error, { url: article.url })
      }
    }

    // 4. 批次保存到數據庫（分批避免 Supabase 限制）
    logger.info('cron.scraper.save_prepare', { toSave: articlesToSave.length })

    if (articlesToSave.length > 0) {
      const INSERT_BATCH_SIZE = 50  // 每批插入 50 條

      for (let i = 0; i < articlesToSave.length; i += INSERT_BATCH_SIZE) {
        const batch = articlesToSave.slice(i, i + INSERT_BATCH_SIZE)
        const { error: bulkInsertError } = await supabase
          .from('raw_articles')
          .insert(batch)

        if (bulkInsertError) {
          logger.error('cron.scraper.bulk_insert_fail', bulkInsertError, { batchIndex: i })
        } else {
          savedCount += batch.length
          logger.info('cron.scraper.batch_saved', { batchIndex: i, count: batch.length })
        }
      }
      logger.info('cron.scraper.save_complete', { savedCount })
    } else {
      logger.info('cron.scraper.nothing_to_save')
    }

    // 3. 清理过期文章
    const { error: cleanupError } = await supabase
      .from('raw_articles')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (cleanupError) {
      logger.error('cron.scraper.cleanup_fail', cleanupError)
    }

    // 4. 记录日志
    await supabase.from('cron_logs').insert({
      job_name: 'scraper',
      status: 'success',
      metadata: {
        total_found: articles.length,
        saved: savedCount,
        skipped: skippedCount,
        duration_ms: Date.now() - startTime
      }
    })

    return NextResponse.json({
      success: true,
      scraped: savedCount,
      skipped: skippedCount,
      total: articles.length,
      samples: results.slice(0, 5),
      duration: Date.now() - startTime
    })

  } catch (error) {
    logger.error('cron.scraper.fail', error)

    // 记录错误日志
    try {
      const supabase = createServiceClient()
      await supabase.from('cron_logs').insert({
        job_name: 'scraper',
        status: 'error',
        metadata: {
          error: getErrorMessage(error),
          duration_ms: Date.now() - startTime
        }
      })
    } catch (logError) {
      logger.error('cron.scraper.log_fail', logError)
    }

    return NextResponse.json(
      {
        error: getErrorMessage(error),
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}


export async function GET(request: NextRequest) {
  return handleCronJob(request)
}

export async function POST(request: NextRequest) {
  return handleCronJob(request)
}
