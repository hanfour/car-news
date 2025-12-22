import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeAllSources } from '@/lib/scraper'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { getErrorMessage } from '@/lib/utils/error'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟（与generator一致）

async function handleCronJob(request: NextRequest) {
  // 验证 Vercel Cron 或手动触发
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET?.trim()}`
  const isManualTrigger = authHeader === expectedAuth

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const supabase = createServiceClient()

    // 1. 爬取所有新闻源
    console.log('Starting scraper...')
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
    console.log(`Checking ${urls.length} URLs for duplicates...`)

    const existingUrls = new Set<string>()
    const BATCH_SIZE = 100  // Supabase .in() 限制約 100 個

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batchUrls = urls.slice(i, i + BATCH_SIZE)
      const { data: existingArticles, error: checkError } = await supabase
        .from('raw_articles')
        .select('url')
        .in('url', batchUrls)

      if (checkError) {
        console.error(`Error checking duplicates batch ${i}:`, checkError)
      } else if (existingArticles) {
        existingArticles.forEach(a => existingUrls.add(a.url))
      }
    }

    console.log(`Found ${existingUrls.size} existing articles to skip`)

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
        console.error(`Error processing article ${article.url}:`, error)
      }
    }

    // 4. 批次保存到數據庫（分批避免 Supabase 限制）
    console.log(`Preparing to save ${articlesToSave.length} articles...`)

    if (articlesToSave.length > 0) {
      const INSERT_BATCH_SIZE = 50  // 每批插入 50 條

      for (let i = 0; i < articlesToSave.length; i += INSERT_BATCH_SIZE) {
        const batch = articlesToSave.slice(i, i + INSERT_BATCH_SIZE)
        const { error: bulkInsertError } = await supabase
          .from('raw_articles')
          .insert(batch)

        if (bulkInsertError) {
          console.error(`Bulk insert error batch ${i}:`, bulkInsertError)
        } else {
          savedCount += batch.length
          console.log(`✓ Saved batch ${i}: ${batch.length} articles`)
        }
      }
      console.log(`✓ Total saved: ${savedCount} articles`)
    } else {
      console.log('No articles to save (all were duplicates or filtered out)')
    }

    // 3. 清理过期文章
    const { error: cleanupError } = await supabase
      .from('raw_articles')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (cleanupError) {
      console.error('Cleanup error:', cleanupError)
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
    console.error('Scraper error:', error)

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
      console.error('Failed to log error:', logError)
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
