import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { clusterArticles } from '@/lib/ai/clustering'
import { generateArticle, decidePublish } from '@/lib/generator'
import { generateShortId } from '@/lib/utils/short-id'
import { generateTopicHash } from '@/lib/utils/topic-hash'
import { groupArticlesByBrand, filterCarArticles } from '@/lib/utils/brand-extractor'
import { generateAndSaveCoverImage } from '@/lib/ai/image-generation'
import { downloadAndStoreImage, downloadAndStoreImages } from '@/lib/storage/image-downloader'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { RawArticle } from '@/types/database'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟

// 配置参数：防止超时的保守策略
const TIMEOUT_CONFIG = {
  MAX_DURATION_MS: 270_000,      // 270秒 (4.5分钟) - 留30秒缓冲
  MAX_ARTICLES_PER_RUN: 10,      // 每次最多处理10篇文章（提高吞吐量）
  TIME_CHECK_INTERVAL: 1000,     // 每1秒检查一次时间
  ESTIMATED_TIME_PER_ARTICLE: 35_000,  // 估计每篇文章需要35秒（根據實際數據調整）
  MIN_TIME_BUFFER: 45_000        // 最小時間緩衝 45 秒（確保安全停止）
}

async function handleCronJob(request: NextRequest) {
  // 验证 Vercel Cron 或手动触发
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization')
  const isManualTrigger = authHeader === `Bearer ${process.env.CRON_SECRET?.trim()}`

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  // 辅助函数：检查是否应该继续处理
  function shouldContinueProcessing(processedCount: number): boolean {
    const elapsedTime = Date.now() - startTime
    const remainingTime = TIMEOUT_CONFIG.MAX_DURATION_MS - elapsedTime
    const estimatedTimeForNext = TIMEOUT_CONFIG.ESTIMATED_TIME_PER_ARTICLE

    // 条件1: 已达到最大文章数限制
    if (processedCount >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN) {
      console.log(`⏸️  Reached article limit (${TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN}), stopping gracefully`)
      return false
    }

    // 条件2: 剩余时间不足以安全处理下一篇
    // 需要預留：1篇文章時間 + 最小緩衝時間
    const minRequiredTime = estimatedTimeForNext + TIMEOUT_CONFIG.MIN_TIME_BUFFER
    if (remainingTime < minRequiredTime) {
      console.log(`⏸️  Insufficient time remaining (${Math.round(remainingTime/1000)}s < ${Math.round(minRequiredTime/1000)}s required), stopping gracefully`)
      return false
    }

    return true
  }

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

    // 1.5 過濾機車和不相關文章（網站專注於汽車）
    const carArticles = filterCarArticles(rawArticles as RawArticle[])
    const filteredCount = rawArticles.length - carArticles.length

    if (filteredCount > 0) {
      console.log(`🚫 Filtered out ${filteredCount} motorcycle/irrelevant articles`)
    }

    if (carArticles.length < 3) {
      return NextResponse.json({
        success: true,
        message: 'Not enough car articles after filtering',
        total: rawArticles.length,
        filtered: filteredCount,
        remaining: carArticles.length
      })
    }

    // 1.6 為沒有 embedding 的文章生成 embedding（批次處理）
    const articlesWithoutEmbedding = carArticles.filter(a => !a.embedding)
    if (articlesWithoutEmbedding.length > 0) {
      console.log(`Generating embeddings for ${articlesWithoutEmbedding.length} articles...`)

      for (const article of articlesWithoutEmbedding) {
        try {
          const embedding = await generateEmbedding(article.content)
          const { error: updateError } = await supabase
            .from('raw_articles')
            .update({ embedding })
            .eq('id', article.id)

          if (updateError) {
            console.error(`Failed to update embedding for ${article.url}:`, updateError)
          } else {
            article.embedding = embedding // 更新本地對象
          }
        } catch (error) {
          console.error(`Failed to generate embedding for ${article.url}:`, error)
        }
      }
      console.log(`✓ Embeddings generated`)
    }

    // 2. 按品牌分組
    console.log('Grouping articles by brand...')
    const brandGroups = groupArticlesByBrand(carArticles)

    console.log(`Found ${brandGroups.size} brand groups:`)
    for (const [brand, articles] of brandGroups.entries()) {
      console.log(`- ${brand}: ${articles.length} articles`)
    }

    // 2.5 智能排序：品牌優先級處理
    // 策略：
    // 1. 高價值品牌優先（Tesla, BMW, Mercedes, Porsche 等）
    // 2. 文章數量多的品牌優先（有新聞價值）
    // 3. "Other" 類別最後處理（避免消耗過多時間）
    const PRIORITY_BRANDS = [
      'Tesla', 'BMW', 'Mercedes', 'Mercedes-Benz', 'Audi', 'Porsche',
      'Ferrari', 'Lamborghini', 'Ford', 'Toyota', 'Volkswagen',
      'Nissan', 'Honda', 'Hyundai', 'Kia', 'Volvo', 'Polestar',
      'Rivian', 'Lucid', 'BYD', 'XPeng', 'NIO'
    ]

    const sortedBrands = Array.from(brandGroups.entries()).sort((a, b) => {
      const [brandA, articlesA] = a
      const [brandB, articlesB] = b

      // 1. "Other" 永遠最後
      if (brandA === 'Other') return 1
      if (brandB === 'Other') return -1

      // 2. 優先品牌排前面
      const isPriorityA = PRIORITY_BRANDS.includes(brandA)
      const isPriorityB = PRIORITY_BRANDS.includes(brandB)
      if (isPriorityA && !isPriorityB) return -1
      if (!isPriorityA && isPriorityB) return 1

      // 3. 文章數量多的優先（有新聞價值）
      return articlesB.length - articlesA.length
    })

    console.log('\n📊 Processing order (by priority):')
    sortedBrands.slice(0, 10).forEach(([brand, articles], idx) => {
      const isPriority = PRIORITY_BRANDS.includes(brand)
      console.log(`  ${idx + 1}. ${brand}: ${articles.length} articles ${isPriority ? '⭐' : ''}`)
    })
    if (sortedBrands.length > 10) {
      console.log(`  ... and ${sortedBrands.length - 10} more brands\n`)
    }

    const results = []
    const today = new Date().toISOString().split('T')[0]
    let totalProcessed = 0
    let skippedDueToTimeout = 0

    // 3. 對每個品牌進行聚類和生成（使用排序後的順序）
    for (const [brand, brandArticles] of sortedBrands) {
      // 在处理每个品牌前检查时间
      if (!shouldContinueProcessing(totalProcessed)) {
        const remainingBrands = sortedBrands.length - (sortedBrands.findIndex(([b]) => b === brand))
        skippedDueToTimeout = remainingBrands
        console.log(`⏭️  Skipping remaining brands (${remainingBrands} left) to avoid timeout`)
        break
      }

      console.log(`\n[${brand}] Processing ${brandArticles.length} articles...`)

      // 3.1 在品牌內進行主題聚類
      // 根據文章數量決定聚類策略：
      // - 1篇：直接生成單篇文章
      // - 2篇：嘗試聚類（最少2篇，相似度0.6）
      // - 3篇以上：正常聚類（最少2篇，相似度0.5）
      let brandClusters = []

      if (brandArticles.length === 1) {
        // 單篇文章直接處理，不需要聚類
        console.log(`[${brand}] Single article, processing directly`)
        const article = brandArticles[0]
        let centroid = article.embedding
        if (typeof centroid === 'string') {
          centroid = JSON.parse(centroid)
        }
        brandClusters.push({
          articles: [article],
          centroid: centroid,
          size: 1,
          similarity: 1.0  // 單篇文章相似度設為1.0
        })
      } else if (brandArticles.length === 2) {
        // 2篇文章：使用較高相似度門檻
        brandClusters = await clusterArticles(brandArticles, 2, 0.6)
      } else {
        // 3篇以上：正常聚類（最少2篇，相似度0.5）
        brandClusters = await clusterArticles(brandArticles, 2, 0.5)
      }

      console.log(`[${brand}] Found ${brandClusters.length} topic clusters`)

      // 如果聚類失敗，嘗試將所有文章合併成一個「品牌週報」
      if (brandClusters.length === 0 && brandArticles.length >= 2) {
        console.log(`[${brand}] No clusters found, creating brand digest`)

        // 解析第一篇文章的 embedding（可能是字串或陣列）
        let centroid = brandArticles[0].embedding
        if (typeof centroid === 'string') {
          centroid = JSON.parse(centroid)
        }

        // 手動創建一個包含所有文章的 cluster
        brandClusters.push({
          articles: brandArticles,
          centroid: centroid,
          size: brandArticles.length,
          similarity: 0.5  // 品牌週報使用預設相似度
        })
      }

      if (brandClusters.length === 0) {
        console.log(`[${brand}] Skipping: no valid clusters`)
        continue
      }

      // 3.2 為每個主題聚類生成文章
      for (const cluster of brandClusters) {
      // 在处理每个cluster前检查时间和数量限制
      if (!shouldContinueProcessing(totalProcessed)) {
        console.log(`[${brand}] ⏸️  Stopping cluster processing to avoid timeout`)
        break
      }

      try {
        // 3.1 计算主题hash（防重复）
        const topicHash = generateTopicHash(cluster.centroid)

        // 3.2 检查最近3天是否已生成相似主題（避免連續幾天重複相同主題）
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
        const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0]

        const { data: existingLocks } = await supabase
          .from('daily_topic_locks')
          .select('article_id, date')
          .gte('date', threeDaysAgoStr)
          .eq('topic_hash', topicHash)
          .order('date', { ascending: false })
          .limit(1)

        if (existingLocks && existingLocks.length > 0) {
          const lastGeneratedDate = existingLocks[0].date
          console.log(`  → Topic already generated on ${lastGeneratedDate}: ${topicHash.slice(0, 8)}`)
          continue
        }

        // 3.3 生成短ID（需要在圖片存儲前生成）
        const shortId = generateShortId()

        // 3.4 调用AI生成文章
        console.log(`[${brand}] → Generating article for cluster (${cluster.articles.length} sources)...`)
        const generated = await generateArticle(cluster.articles)

        // 3.4.1 檢查是否已存在相同標題的文章（防止重複）
        const { data: exactDuplicate } = await supabase
          .from('generated_articles')
          .select('id')
          .eq('title_zh', generated.title_zh)
          .single()

        if (exactDuplicate) {
          console.log(`[${brand}] ⚠ Article with same title already exists: "${generated.title_zh}"`)
          console.log(`[${brand}] → Skipping to avoid duplicate`)
          continue
        }

        // 3.4.2 檢查是否已存在極度相似的文章（相似標題 + 今天生成）
        // 提取標題關鍵詞（移除常見詞彙）
        const titleKeywords = generated.title_zh
          .replace(/與|和|的|年式|登場|推出|售價|美元|起|，/g, ' ')
          .trim()
          .split(/\s+/)
          .filter(w => w.length > 1)
          .slice(0, 3)  // 取前 3 個關鍵詞

        let shouldSkip = false

        if (titleKeywords.length > 0) {
          const { data: similarArticles } = await supabase
            .from('generated_articles')
            .select('id, title_zh')
            .gte('created_at', today)  // 只檢查今天生成的文章
            .limit(20)

          if (similarArticles && similarArticles.length > 0) {
            for (const existing of similarArticles) {
              // 檢查是否包含相同的關鍵詞
              const matchCount = titleKeywords.filter(keyword =>
                (existing.title_zh as string).includes(keyword)
              ).length

              // 如果有 2 個以上關鍵詞匹配,認為是相似文章
              if (matchCount >= 2) {
                console.log(`[${brand}] ⚠ Similar article already exists:`)
                console.log(`[${brand}]   Existing: "${existing.title_zh}"`)
                console.log(`[${brand}]   New:      "${generated.title_zh}"`)
                console.log(`[${brand}]   Match:    ${matchCount}/${titleKeywords.length} keywords`)
                console.log(`[${brand}] → Skipping to avoid near-duplicate`)
                shouldSkip = true
                break  // 跳出內層 for 循環
              }
            }
          }
        }

        if (shouldSkip) {
          continue  // 跳到下一個 cluster
        }

        // 3.5 收集該 cluster 所有圖片（外部 URL）
        const sourceImages: Array<{ url: string; credit: string; caption?: string }> = []
        for (const article of cluster.articles) {
          if (article.image_url) {
            sourceImages.push({
              url: article.image_url,
              credit: article.image_credit || 'Unknown',
              caption: article.title.slice(0, 100) // 使用文章標題作為圖片說明
            })
          }
        }

        console.log(`[${brand}] → Found ${sourceImages.length} source images, downloading and storing...`)

        // 3.4.1 下載並存儲圖片到 Supabase Storage
        const storedImages = await downloadAndStoreImages(sourceImages, shortId)
        console.log(`[${brand}] → Successfully stored ${storedImages.length}/${sourceImages.length} images`)

        // 3.4.2 決定封面圖片來源
        let coverImage = generated.coverImage
        let imageCredit = generated.imageCredit

        // 優先順序：1. AI生成的coverImage  2. 來源文章第一張圖  3. AI生成封面圖
        if (generated.coverImage) {
          // 下載並存儲 AI 生成的封面圖
          console.log(`[${brand}] → Downloading AI-generated cover image...`)
          const storedCover = await downloadAndStoreImage(
            generated.coverImage,
            shortId,
            'AI Generated'
          )
          if (storedCover) {
            coverImage = storedCover.url
            imageCredit = storedCover.credit
            console.log(`[${brand}] → ✓ AI cover image stored`)
          }
        } else if (storedImages.length > 0) {
          // 使用來源文章的第一張圖片作為封面
          coverImage = storedImages[0].url
          imageCredit = storedImages[0].credit
          console.log(`[${brand}] → Using first source image as cover`)
        } else if (sourceImages.length === 0) {
          // 完全沒有圖片時，生成 AI 封面圖
          console.log(`[${brand}] → No images found, generating and saving AI cover image...`)
          const aiImage = await generateAndSaveCoverImage(
            generated.title_zh,
            generated.content_zh,
            generated.brands
          )

          if (aiImage && aiImage.url) {
            coverImage = aiImage.url
            imageCredit = aiImage.credit
            console.log(`[${brand}] ✓ AI cover image generated and saved`)
          } else {
            console.log(`[${brand}] ✗ AI image generation failed`)
          }
        }

        // 3.5 计算来源文章的最早发布时间
        const sourceDates = cluster.articles
          .map(a => a.published_at)
          .filter((date): date is string => !!date)
          .map(date => new Date(date))
        const earliestSourceDate = sourceDates.length > 0
          ? new Date(Math.min(...sourceDates.map(d => d.getTime()))).toISOString()
          : today

        // 3.6 质量检查和发布决策
        const decision = decidePublish(generated)

        // 3.7 限制品牌數量：確保 primary_brand 在首位，最多保留 3 個品牌
        const allBrands = generated.brands || []
        let filteredBrands: string[] = []

        // 如果有 primary_brand，確保它在第一位
        if (brand !== 'Other') {
          filteredBrands.push(brand)
          // 添加其他品牌（不包括 primary_brand），最多再加 2 個
          const otherBrands = allBrands.filter(b => b !== brand).slice(0, 2)
          filteredBrands.push(...otherBrands)
        } else {
          // 沒有 primary_brand 時，直接取前 3 個
          filteredBrands = allBrands.slice(0, 3)
        }

        // 3.8 保存文章（包含标签、封面圖、品牌、多張圖片、來源時間）
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
            source_date: earliestSourceDate,
            brands: filteredBrands,
            car_models: generated.car_models || [],
            categories: generated.categories || [],
            tags: generated.tags || [],
            cover_image: coverImage || null,
            image_credit: imageCredit || null,
            primary_brand: brand === 'Other' ? null : brand,
            images: storedImages.length > 0 ? storedImages : []
          })
          .select()
          .single()

        if (insertError) {
          console.error('Failed to insert article:', insertError)
          continue
        }

        // 3.7 创建topic lock (防止重複生成相似主題)
        const { error: lockError } = await supabase.from('daily_topic_locks').insert({
          date: today,
          topic_hash: topicHash,
          article_id: shortId
        })

        if (lockError) {
          console.error(`[${brand}] ⚠ Failed to create topic lock:`, lockError)
          // 如果 topic lock 創建失敗,這篇文章可能會被重複生成
          // 但我們還是保留已生成的文章(因為已經消耗了 API 額度)
        }

        results.push({
          id: shortId,
          brand,
          title: generated.title_zh,
          confidence: generated.confidence,
          published: decision.shouldPublish,
          reason: decision.reason,
          images_count: storedImages.length
        })

        totalProcessed++  // 增加已处理计数
        console.log(`[${brand}] ✓ ${decision.shouldPublish ? 'Published' : 'Saved'}: ${generated.title_zh} (${storedImages.length} images stored) [${totalProcessed}/${TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN}]`)

      } catch (error: any) {
        console.error(`[${brand}] Error generating article for cluster:`, error)
        // 继续处理下一个聚类
      }
      }
    }

    // 4. 统计和记录日志
    const totalClusters = Array.from(brandGroups.values())
      .reduce((sum, articles) => sum + (articles.length >= 3 ? 1 : 0), 0)

    const elapsedTime = Date.now() - startTime
    const hitTimeout = totalProcessed >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN ||
                       elapsedTime >= TIMEOUT_CONFIG.MAX_DURATION_MS

    if (hitTimeout) {
      console.log(`\n⏸️  === GRACEFUL STOP ===`)
      console.log(`Processed: ${totalProcessed} articles`)
      console.log(`Time: ${Math.round(elapsedTime/1000)}s / ${TIMEOUT_CONFIG.MAX_DURATION_MS/1000}s`)
      console.log(`Reason: ${totalProcessed >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN ? 'Article limit' : 'Time limit'}`)
      console.log(`Note: Remaining articles will be processed in next run\n`)
    }

    await supabase.from('cron_logs').insert({
      job_name: 'generator',
      status: 'success',
      metadata: {
        raw_articles: rawArticles.length,
        motorcycle_filtered: filteredCount,
        car_articles: carArticles.length,
        brand_groups: brandGroups.size,
        total_clusters: totalClusters,
        articles_generated: results.length,
        articles_published: results.filter(r => r.published).length,
        duration_ms: elapsedTime,
        hit_timeout: hitTimeout,
        timeout_reason: hitTimeout ? (totalProcessed >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN ? 'article_limit' : 'time_limit') : null,
        brands: Object.fromEntries(
          Array.from(brandGroups.entries()).map(([brand, articles]) => [brand, articles.length])
        )
      }
    })

    return NextResponse.json({
      success: true,
      generated: results.length,
      published: results.filter(r => r.published).length,
      articles: results,
      duration: elapsedTime,
      timeout_info: hitTimeout ? {
        hit_limit: true,
        processed: totalProcessed,
        max_per_run: TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN,
        reason: totalProcessed >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN ? 'article_limit' : 'time_limit'
      } : null
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


export async function GET(request: NextRequest) {
  return handleCronJob(request)
}

export async function POST(request: NextRequest) {
  return handleCronJob(request)
}
