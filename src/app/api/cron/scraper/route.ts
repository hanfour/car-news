import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeAllSources } from '@/lib/scraper'
import { generateEmbedding } from '@/lib/ai/embeddings'

export const maxDuration = 60 // Vercel Pro限制：最长60秒

export async function GET(request: NextRequest) {
  // 验证Cron密钥
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    // 2. 处理每篇文章
    for (const article of articles) {
      try {
        // 检查URL是否已存在
        const { data: existing } = await supabase
          .from('raw_articles')
          .select('id')
          .eq('url', article.url)
          .single()

        if (existing) {
          skippedCount++
          continue
        }

        // 生成embedding
        const embedding = await generateEmbedding(article.content)

        // 计算过期时间（72小时后）
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

        // 保存到数据库
        const { error } = await supabase
          .from('raw_articles')
          .insert({
            url: article.url,
            title: article.title,
            content: article.content,
            scraped_at: new Date().toISOString(),
            published_at: article.publishedAt?.toISOString() || new Date().toISOString(),
            expires_at: expiresAt,
            embedding,
            image_url: article.imageUrl || null,
            image_credit: article.source || null
          })

        if (error) {
          console.error(`Failed to save article ${article.url}:`, error)
        } else {
          savedCount++
          results.push({
            url: article.url,
            title: article.title.slice(0, 100)
          })
        }
      } catch (error) {
        console.error(`Error processing article ${article.url}:`, error)
      }
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
