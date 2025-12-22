import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { clusterArticles } from '@/lib/ai/clustering'
import { generateArticle, decidePublish } from '@/lib/generator'
import { generateShortId } from '@/lib/utils/short-id'
import { groupArticlesByBrand, filterCarArticles } from '@/lib/utils/brand-extractor'
import { generateAndSaveCoverImage } from '@/lib/ai/image-generation'
import { downloadAndStoreImage, downloadAndStoreImages } from '@/lib/storage/image-downloader'
import { generateEmbedding, cosineSimilarity } from '@/lib/ai/embeddings'
import { RawArticle } from '@/types/database'
import { getErrorMessage } from '@/lib/utils/error'
import {
  checkTitleDuplicate,
  generateTopicHash,
  checkTopicLock,
  createTopicLock,
  markRawArticlesAsUsed
} from '@/lib/utils/deduplication'
import { comprehensiveDuplicateCheck } from '@/lib/utils/advanced-deduplication'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟

// 配置参数：小批量高频率策略（避免超时）
// 策略：每小时执行一次，每次生成 10 篇，确保在 5 分钟内完成
const TIMEOUT_CONFIG = {
  MAX_DURATION_MS: 270_000,      // 270秒 (4.5分钟) - 留30秒缓冲
  MAX_ARTICLES_PER_RUN: 15,      // 每次最多处理15篇（留安全余量）
  MIN_ARTICLES_PER_BRAND: 1,     // 品牌配額：每個品牌至少生成1篇（確保多樣性）
  TARGET_ARTICLES: 10,           // 目標文章數：每次執行目標生成10篇（耗時 ~4 分鐘）
  TIME_CHECK_INTERVAL: 1000,     // 每1秒检查一次时间
  ESTIMATED_TIME_PER_ARTICLE: 25_000,  // Gemini 更快：估计每篇文章需要25秒（vs Claude 35秒）
  MIN_TIME_BUFFER: 45_000        // 最小時間緩衝 45 秒
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

    // 条件2: 如果還沒達到目標文章數，繼續處理（除非時間真的不夠了）
    if (processedCount < TIMEOUT_CONFIG.TARGET_ARTICLES) {
      const minRequiredTime = estimatedTimeForNext + TIMEOUT_CONFIG.MIN_TIME_BUFFER
      if (remainingTime < minRequiredTime) {
        console.log(`⏸️  Target not met (${processedCount}/${TIMEOUT_CONFIG.TARGET_ARTICLES}) but time insufficient (${Math.round(remainingTime/1000)}s < ${Math.round(minRequiredTime/1000)}s)`)
        return false
      }
      // 還沒達到目標且時間充裕，繼續處理
      return true
    }

    // 条件3: 已達到目標，但如果時間還很充裕，可以繼續處理更多品牌
    const minRequiredTime = estimatedTimeForNext + TIMEOUT_CONFIG.MIN_TIME_BUFFER
    if (remainingTime < minRequiredTime) {
      console.log(`⏸️  Target met (${processedCount}/${TIMEOUT_CONFIG.TARGET_ARTICLES}), time limit reached`)
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
    // 可通過環境變量 DISABLE_EMBEDDINGS=true 臨時禁用（當 OpenAI API 配額用完時）
    const DISABLE_EMBEDDINGS = process.env.DISABLE_EMBEDDINGS === 'true'

    if (DISABLE_EMBEDDINGS) {
      console.log('⚠️  Embeddings generation is disabled (DISABLE_EMBEDDINGS=true)')
    } else {
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
    }

    // 2. 按品牌分組
    console.log('Grouping articles by brand...')
    const brandGroups = groupArticlesByBrand(carArticles)

    console.log(`Found ${brandGroups.size} brand groups:`)
    for (const [brand, articles] of brandGroups.entries()) {
      console.log(`- ${brand}: ${articles.length} articles`)
    }

    // 2.5 智能排序：品牌多樣性優先策略
    // 三重策略組合：
    // A. 品牌輪換機制 - 使用日期作為種子輪換優先順序
    // B. 品牌配額制度 - 確保每個品牌至少有機會被處理
    // C. 增加處理數量 - 提高文章生成限制
    // 確保品牌名稱與 brand-extractor.ts 返回的名稱完全匹配
    const PRIORITY_BRANDS = [
      'Tesla', 'BYD', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
      'Toyota', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Chevrolet',
      'Porsche', 'Ferrari', 'Lamborghini', 'NIO', 'XPeng', 'Li Auto'
    ]

    // A. 品牌輪換機制：使用日期作為種子來輪換優先級
    const today = new Date()
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
    const rotationSeed = dayOfYear % PRIORITY_BRANDS.length

    // 輪換優先品牌列表
    const rotatedPriorityBrands = [
      ...PRIORITY_BRANDS.slice(rotationSeed),
      ...PRIORITY_BRANDS.slice(0, rotationSeed)
    ]

    console.log(`\n🔄 Brand rotation (seed: day ${dayOfYear}, offset: ${rotationSeed})`)
    console.log(`   Today's priority: ${rotatedPriorityBrands.slice(0, 5).join(', ')}...`)

    const sortedBrands = Array.from(brandGroups.entries()).sort((a, b) => {
      const [brandA, articlesA] = a
      const [brandB, articlesB] = b

      // 1. "Other" 永遠最後
      if (brandA === 'Other') return 1
      if (brandB === 'Other') return -1

      // 2. 使用輪換後的優先品牌列表
      const priorityIndexA = rotatedPriorityBrands.indexOf(brandA)
      const priorityIndexB = rotatedPriorityBrands.indexOf(brandB)

      const isPriorityA = priorityIndexA !== -1
      const isPriorityB = priorityIndexB !== -1

      // 兩個都是優先品牌：按輪換後的順序排
      if (isPriorityA && isPriorityB) {
        return priorityIndexA - priorityIndexB
      }

      // 只有一個是優先品牌
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
    const todayStr = new Date().toISOString().split('T')[0]
    let totalProcessed = 0
    let skippedDueToTimeout = 0

    // C. 品牌配額追踪：記錄每個品牌已生成的文章數
    const brandQuotaTracker = new Map<string, number>()

    // D. 品牌配額上限：防止單一品牌佔據過多配額
    const MAX_ARTICLES_PER_BRAND = 3  // 每小時每個品牌最多生成 3 篇文章（配合高頻率執行，保持品牌多樣性）

    // 3. 對每個品牌進行聚類和生成（使用排序後的順序）
    for (const [brand, brandArticles] of sortedBrands) {
      const brandProcessedCount = brandQuotaTracker.get(brand) || 0

      // D. 品牌配額上限檢查：如果品牌已達到配額上限，跳過該品牌
      if (brandProcessedCount >= MAX_ARTICLES_PER_BRAND) {
        console.log(`[${brand}] ⏭️  Skipping - reached max quota (${brandProcessedCount}/${MAX_ARTICLES_PER_BRAND})`)
        continue
      }

      // C. 品牌配額檢查：如果品牌還沒達到最小配額，即使時間緊張也繼續處理
      const hasMetQuota = brandProcessedCount >= TIMEOUT_CONFIG.MIN_ARTICLES_PER_BRAND
      const shouldProcessForQuota = !hasMetQuota && totalProcessed < TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN

      // 在处理每个品牌前检查時間（但優先確保品牌配額）
      if (!shouldProcessForQuota && !shouldContinueProcessing(totalProcessed)) {
        const remainingBrands = sortedBrands.length - (sortedBrands.findIndex(([b]) => b === brand))
        skippedDueToTimeout = remainingBrands
        console.log(`⏭️  Skipping remaining brands (${remainingBrands} left) - quota met and timeout approaching`)
        break
      }

      if (shouldProcessForQuota && !shouldContinueProcessing(totalProcessed)) {
        console.log(`[${brand}] ⚡ Processing despite time pressure (quota: ${brandProcessedCount}/${TIMEOUT_CONFIG.MIN_ARTICLES_PER_BRAND})`)
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
      // ============ SOLUTION 3: Topic Lock Check ============
      // Generate topic hash from cluster centroid
      let centroid = cluster.centroid
      if (typeof centroid === 'string') {
        centroid = JSON.parse(centroid)
      }
      const topicHash = generateTopicHash(centroid as number[])

      // Check if this topic was generated recently (within 2 days)
      const topicLockResult = await checkTopicLock(topicHash, 2)
      if (topicLockResult.locked) {
        console.log(`[${brand}] 🔒 Topic locked (generated ${topicLockResult.date}, article: ${topicLockResult.articleId})`)
        console.log(`[${brand}] → Skipping to avoid duplicate topic`)
        continue
      }
      // ======================================================

      // 在处理每个cluster前检查时间和数量限制
      if (!shouldContinueProcessing(totalProcessed)) {
        console.log(`[${brand}] ⏸️  Stopping cluster processing to avoid timeout`)
        break
      }

      try {
        // 3.1 生成短ID（需要在圖片存儲前生成）
        const shortId = generateShortId()

        // 3.4 调用AI生成文章
        console.log(`[${brand}] → Generating article for cluster (${cluster.articles.length} sources)...`)
        const generated = await generateArticle(cluster.articles)

        // ============ COMPREHENSIVE DUPLICATE CHECK ============
        // Step 1: Generate embedding for the new article
        console.log(`[${brand}] → Running comprehensive duplicate check...`)
        const newContentEmbedding = await generateEmbedding(
          `${generated.title_zh}\n\n${generated.content_zh}`
        )

        // Step 2: Run all duplicate checks (brand frequency, keyword overlap, embedding similarity)
        const duplicateResult = await comprehensiveDuplicateCheck({
          title: generated.title_zh,
          embedding: newContentEmbedding,
          brand: brand === 'Other' ? 'Unknown' : brand
        })

        if (duplicateResult.isDuplicate) {
          console.log(`[${brand}] 🚫 Duplicate detected: ${duplicateResult.reason}`)
          if (duplicateResult.relatedArticle) {
            console.log(`[${brand}]   Related: "${duplicateResult.relatedArticle.title_zh}"`)
          }
          console.log(`[${brand}] → Skipping to avoid duplicate`)
          continue
        }

        console.log(`[${brand}] ✓ Passed duplicate check`)
        // =======================================================

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

        // 優先順序：1. AI生成的coverImage  2. 來源文章第一張圖  3. 智能 AI 生成
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
        } else {
          // 沒有可用圖片時的智能策略
          // 注意：sourceImages 可能存在但下載失敗（storedImages.length === 0）
          console.log(`[${brand}] → No images available (source: ${sourceImages.length}, stored: ${storedImages.length})`)

          // 智能判斷是否生成 AI 圖片
          // 成本考量：DALL-E 3 ($0.08/張) vs Gemini 文字 ($0.000675/篇) = 100x 差異
          // 可通過環境變數 ENABLE_AI_IMAGE_GENERATION 控制（默認啟用）
          const enableAIGeneration = process.env.ENABLE_AI_IMAGE_GENERATION !== 'false'

          if (enableAIGeneration) {
            console.log(`[${brand}] → No source images, generating AI cover (cost: $0.08)...`)
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
          } else {
            console.log(`[${brand}] ⏭️  AI image generation disabled (ENABLE_AI_IMAGE_GENERATION=false)`)
            // AI 圖片生成已關閉，文章將沒有封面圖
          }
        }

        // 3.5 计算来源文章的最早发布时间（UTC）
        const sourceDates = cluster.articles
          .map(a => a.source_published_at)
          .filter((date): date is string => !!date)
          .map(date => new Date(date))
        const earliestSourceDateUTC = sourceDates.length > 0
          ? new Date(Math.min(...sourceDates.map(d => d.getTime())))
          : null

        // 3.5.1 將 UTC 時間轉換為台灣時區日期（YYYY-MM-DD）
        let publishedAtTaiwan: string | null = null
        if (earliestSourceDateUTC) {
          // 台灣時區是 UTC+8
          const taiwanDate = new Date(earliestSourceDateUTC.getTime() + 8 * 60 * 60 * 1000)
          publishedAtTaiwan = taiwanDate.toISOString().split('T')[0]
        }

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

        // 3.8 保存文章（包含标签、封面圖、品牌、多張圖片、來源時間、content_embedding）
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
            published_at: decision.shouldPublish ? publishedAtTaiwan : null,
            source_published_at: earliestSourceDateUTC?.toISOString() || null,
            brands: filteredBrands,
            car_models: generated.car_models || [],
            categories: generated.categories || [],
            tags: generated.tags || [],
            cover_image: coverImage || null,
            image_credit: imageCredit || null,
            primary_brand: brand === 'Other' ? null : brand,
            images: storedImages.length > 0 ? storedImages : [],
            content_embedding: newContentEmbedding
          })
          .select()
          .single()

        if (insertError) {
          console.error('Failed to insert article:', insertError)
          continue
          // 但我們還是保留已生成的文章(因為已經消耗了 API 額度)
        }

        // ============ SOLUTION 2: Mark Raw Articles as Used ============
        // Mark all source articles as used to prevent reuse
        const rawArticleIds = cluster.articles.map(a => a.id)
        const markedSuccess = await markRawArticlesAsUsed(rawArticleIds, shortId)
        if (markedSuccess) {
          console.log(`[${brand}] 📌 Marked ${rawArticleIds.length} raw articles as used`)
        } else {
          console.log(`[${brand}] ⚠ Failed to mark raw articles as used (non-fatal)`)
        }
        // ===============================================================

        // ============ SOLUTION 3: Create Topic Lock ============
        // Lock this topic to prevent regeneration within 2 days
        const lockSuccess = await createTopicLock(topicHash, shortId)
        if (lockSuccess) {
          console.log(`[${brand}] 🔒 Topic locked: ${topicHash.slice(0, 12)}...`)
        } else {
          console.log(`[${brand}] ⚠ Failed to create topic lock (non-fatal)`)
        }
        // =======================================================

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

        // C. 更新品牌配額追踪
        brandQuotaTracker.set(brand, (brandQuotaTracker.get(brand) || 0) + 1)

        console.log(`[${brand}] ✓ ${decision.shouldPublish ? 'Published' : 'Saved'}: ${generated.title_zh} (${storedImages.length} images stored) [${totalProcessed}/${TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN}]`)

      } catch (error) {
        console.error(`[${brand}] Error generating article for cluster:`, getErrorMessage(error))
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

  } catch (error) {
    console.error('Generator error:', error)

    // 记录错误日志
    try {
      const supabase = createServiceClient()
      await supabase.from('cron_logs').insert({
        job_name: 'generator',
        status: 'error',
        metadata: {
          error: getErrorMessage(error),
          stack: error instanceof Error ? error.stack : undefined,
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
