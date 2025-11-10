import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { clusterArticles } from '@/lib/ai/clustering'
import { generateArticle, decidePublish } from '@/lib/generator'
import { generateShortId } from '@/lib/utils/short-id'
import { generateTopicHash } from '@/lib/utils/topic-hash'
import { RawArticle } from '@/types/database'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟

export async function GET(request: NextRequest) {
  // 验证Cron密钥
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const supabase = createServiceClient()

    // 1. 获取所有未过期的文章
    console.log('Fetching raw articles...')
    const { data: rawArticles, error: fetchError } = await supabase
      .from('raw_articles')
      .select('*')
      .gt('expires_at', new Date().toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch articles: ${fetchError.message}`)
    }

    if (!rawArticles || rawArticles.length < 3) {
      return NextResponse.json({
        success: true,
        message: 'Not enough articles to cluster',
        count: rawArticles?.length || 0
      })
    }

    console.log(`Found ${rawArticles.length} articles`)

    // 2. 聚类分析
    console.log('Clustering articles...')
    const clusters = await clusterArticles(rawArticles as RawArticle[], 3, 0.7)

    console.log(`Found ${clusters.length} clusters`)

    if (clusters.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid clusters found',
        articles_count: rawArticles.length
      })
    }

    const results = []
    const today = new Date().toISOString().split('T')[0]

    // 3. 为每个聚类生成文章
    for (const cluster of clusters) {
      try {
        // 3.1 计算主题hash（防重复）
        const topicHash = generateTopicHash(cluster.centroid)

        // 3.2 检查今天是否已生成相似主题
        const { data: existingLock } = await supabase
          .from('daily_topic_locks')
          .select('article_id')
          .eq('date', today)
          .eq('topic_hash', topicHash)
          .single()

        if (existingLock) {
          console.log(`  → Topic already generated today: ${topicHash.slice(0, 8)}`)
          continue
        }

        // 3.3 调用AI生成文章
        console.log(`  → Generating article for cluster (${cluster.articles.length} sources)...`)
        const generated = await generateArticle(cluster.articles)

        // 3.4 质量检查和发布决策
        const decision = decidePublish(generated)

        // 3.5 生成短ID
        const shortId = generateShortId()

        // 3.6 保存文章（包含标签）
        const { data: article, error: insertError } = await supabase
          .from('generated_articles')
          .insert({
            id: shortId,
            title_zh: generated.title_zh,
            content_zh: generated.content_zh,
            slug_en: generated.slug_en,
            source_urls: cluster.articles.map(a => a.url),
            confidence: generated.confidence,
            quality_checks: generated.quality_checks,
            reasoning: generated.reasoning,
            style_version: 'v1.0',
            published: decision.shouldPublish,
            published_at: decision.shouldPublish ? today : null,
            brands: generated.brands || [],
            car_models: generated.car_models || [],
            categories: generated.categories || [],
            tags: generated.tags || []
          })
          .select()
          .single()

        if (insertError) {
          console.error('Failed to insert article:', insertError)
          continue
        }

        // 3.7 创建topic lock
        await supabase.from('daily_topic_locks').insert({
          date: today,
          topic_hash: topicHash,
          article_id: shortId
        })

        results.push({
          id: shortId,
          title: generated.title_zh,
          confidence: generated.confidence,
          published: decision.shouldPublish,
          reason: decision.reason
        })

        console.log(`  ✓ ${decision.shouldPublish ? 'Published' : 'Saved'}: ${generated.title_zh}`)

      } catch (error: any) {
        console.error('Error generating article for cluster:', error)
        // 继续处理下一个聚类
      }
    }

    // 4. 记录日志
    await supabase.from('cron_logs').insert({
      job_name: 'generator',
      status: 'success',
      metadata: {
        raw_articles: rawArticles.length,
        clusters_found: clusters.length,
        articles_generated: results.length,
        articles_published: results.filter(r => r.published).length,
        duration_ms: Date.now() - startTime
      }
    })

    return NextResponse.json({
      success: true,
      generated: results.length,
      published: results.filter(r => r.published).length,
      articles: results,
      duration: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Generator error:', error)

    // 记录错误日志
    try {
      const supabase = createServiceClient()
      await supabase.from('cron_logs').insert({
        job_name: 'generator',
        status: 'error',
        metadata: {
          error: error.message,
          stack: error.stack,
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
