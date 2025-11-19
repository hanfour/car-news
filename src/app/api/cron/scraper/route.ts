import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeAllSources } from '@/lib/scraper'
import { generateEmbedding } from '@/lib/ai/embeddings'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟（与generator一致）

async function handleCronJob(request: NextRequest) {
  // 验证 Vercel Cron 或手动触发
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization')
  // Trim CRON_SECRET to remove any trailing newlines or whitespace
  const expectedAuth = `Bearer ${process.env.CRON_SECRET?.trim()}`
  const isManualTrigger = authHeader === expectedAuth

  // Debug logging
  console.log('Auth Debug:', {
    isVercelCron,
    hasAuthHeader: !!authHeader,
    authMatches: isManualTrigger,
    receivedLength: authHeader?.length,
    expectedLength: expectedAuth.length,
    receivedPrefix: authHeader?.substring(0, 30) + '...',
    expectedPrefix: expectedAuth.substring(0, 30) + '...',
    receivedSuffix: authHeader?.substring(authHeader.length - 10),
    expectedSuffix: expectedAuth.substring(expectedAuth.length - 10),
    envSecretLength: process.env.CRON_SECRET?.length
  })

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({
      error: 'Unauthorized',
      debug: process.env.NODE_ENV === 'development' ? {
        isVercelCron,
        hasAuth: !!authHeader
      } : undefined
    }, { status: 401 })
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

    // 2. 批次檢查重複（優化：一次查詢所有URL）
    const urls = articles.map(a => a.url)
    console.log(`Checking ${urls.length} URLs for duplicates...`)

    const { data: existingArticles, error: checkError } = await supabase
      .from('raw_articles')
      .select('url')
      .in('url', urls)

    if (checkError) {
      console.error('Error checking duplicates:', checkError)
    }

    const existingUrls = new Set(existingArticles?.map(a => a.url) || [])
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

    // 4. 批次保存到數據庫
    console.log(`Preparing to save ${articlesToSave.length} articles...`)

    if (articlesToSave.length > 0) {
      const { error: bulkInsertError } = await supabase
        .from('raw_articles')
        .insert(articlesToSave)

      if (bulkInsertError) {
        console.error('Bulk insert error:', bulkInsertError)
      } else {
        savedCount = articlesToSave.length
        console.log(`✓ Saved ${savedCount} articles`)
      }
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

  } catch (error: any) {
    console.error('Scraper error:', error)

    // 记录错误日志
    try {
      const supabase = createServiceClient()
      await supabase.from('cron_logs').insert({
        job_name: 'scraper',
        status: 'error',
        metadata: {
          error: error.message,
          duration_ms: Date.now() - startTime
        }
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      {
        error: error.message,
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
