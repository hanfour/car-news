import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { clusterArticles } from '@/lib/ai/clustering'
import { generateArticle, decidePublish } from '@/lib/generator'
import { generateShortId } from '@/lib/utils/short-id'
import { groupArticlesByBrand } from '@/lib/utils/brand-extractor'
import { generateAndSaveCoverImage } from '@/lib/ai/image-generation'
import { downloadAndStoreImage, downloadAndStoreImages } from '@/lib/storage/image-downloader'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { RawArticle } from '@/types/database'
import { getErrorMessage } from '@/lib/utils/error'
import {
  generateTopicHash,
  checkTopicLock,
  createTopicLock,
  markRawArticlesAsUsed
} from '@/lib/utils/deduplication'
import { comprehensiveDuplicateCheck, checkBrandFrequency } from '@/lib/utils/advanced-deduplication'
import { collectByRoundRobin, sortBrandsByPriority } from '@/lib/generator/round-robin'
import { createSocialPostsForArticle } from '@/lib/social/auto-publisher'
import { verifyCronAuth, unauthorized } from '@/lib/cron/auth'
import { TIMEOUT_CONFIG, PRIORITY_BRANDS, MAX_ARTICLES_PER_BRAND } from './steps/config'
import { shouldContinueProcessing } from './steps/should-continue'
import { prepareRawArticles } from './steps/prepare-articles'

export const maxDuration = 300 // Vercel Pro限制：最长5分钟

async function handleCronJob(request: NextRequest) {
  if (!(await verifyCronAuth(request))) {
    return unauthorized()
  }

  const startTime = Date.now()

  try {
    const supabase = createServiceClient()

    // 1. 前置資料準備：抓取 + 過濾機車/不相關 + 補 embedding
    const { rawCount, filteredCount, carArticles } = await prepareRawArticles(supabase)

    if (rawCount < 3) {
      return NextResponse.json({
        success: true,
        message: 'Not enough articles to cluster',
        count: rawCount
      })
    }

    if (carArticles.length < 3) {
      return NextResponse.json({
        success: true,
        message: 'Not enough car articles after filtering',
        total: rawCount,
        filtered: filteredCount,
        remaining: carArticles.length
      })
    }

    // 2. 按品牌分組
    console.log('Grouping articles by brand...')
    const brandGroups = groupArticlesByBrand(carArticles)

    console.log(`Found ${brandGroups.size} brand groups:`)
    for (const [brand, articles] of brandGroups.entries()) {
      console.log(`- ${brand}: ${articles.length} articles`)
    }

    // 2.5 品牌優先級排序（PRIORITY_BRANDS 定義於 steps/config）
    const sortedBrandList = sortBrandsByPriority(brandGroups, PRIORITY_BRANDS as unknown as string[])

    console.log('\n📊 Brand priority order:')
    sortedBrandList.slice(0, 10).forEach(({ brand, articles }, idx) => {
      const isPriority = PRIORITY_BRANDS.includes(brand)
      console.log(`  ${idx + 1}. ${brand}: ${articles.length} articles ${isPriority ? '⭐' : ''}`)
    })
    if (sortedBrandList.length > 10) {
      console.log(`  ... and ${sortedBrandList.length - 10} more brands\n`)
    }

    // 2.6 預先對所有品牌進行聚類
    console.log('\n🔄 Pre-clustering all brands...')
    type BrandClusterData = {
      brand: string
      clusters: Array<{
        articles: RawArticle[]
        centroid: number[] | null
        size: number
        similarity: number
      }>
    }
    const allBrandClusters: BrandClusterData[] = []

    for (const { brand, articles: brandArticles } of sortedBrandList) {
      let brandClusters: Array<{
        articles: RawArticle[]
        centroid: number[] | null
        size: number
        similarity: number
      }> = []

      if (brandArticles.length === 1) {
        const article = brandArticles[0] as RawArticle
        let centroid = article.embedding
        if (typeof centroid === 'string') {
          centroid = JSON.parse(centroid)
        }
        brandClusters.push({
          articles: [article],
          centroid: centroid as number[] | null,
          size: 1,
          similarity: 1.0
        })
      } else if (brandArticles.length === 2) {
        brandClusters = await clusterArticles(brandArticles as RawArticle[], 2, 0.6)
      } else {
        brandClusters = await clusterArticles(brandArticles as RawArticle[], 2, 0.5)
      }

      // 如果聚類失敗，嘗試創建品牌週報
      if (brandClusters.length === 0 && brandArticles.length >= 2) {
        let centroid = (brandArticles[0] as RawArticle).embedding
        if (typeof centroid === 'string') {
          centroid = JSON.parse(centroid)
        }
        brandClusters.push({
          articles: brandArticles as RawArticle[],
          centroid: centroid as number[] | null,
          size: brandArticles.length,
          similarity: 0.5
        })
      }

      if (brandClusters.length > 0) {
        allBrandClusters.push({ brand, clusters: brandClusters })
        console.log(`  [${brand}] ${brandClusters.length} clusters`)
      }
    }

    console.log(`\n✓ Pre-clustering complete: ${allBrandClusters.length} brands with clusters`)

    // 2.7 使用輪盤算法收集要處理的 clusters（MAX_ARTICLES_PER_BRAND 定義於 steps/config）
    const { collected, roundsCompleted } = await collectByRoundRobin(
      allBrandClusters,
      TIMEOUT_CONFIG.TARGET_ARTICLES,
      MAX_ARTICLES_PER_BRAND
    )

    console.log(`\n🎡 Round-robin collection: ${collected.length} items from ${roundsCompleted} rounds`)

    const results = []
    let totalProcessed = 0
    let skippedDueToTimeout = 0

    // 3. 按輪盤順序處理收集到的 clusters
    for (const { brand, cluster } of collected) {
      // 時間檢查
      const cont = shouldContinueProcessing({ processedCount: totalProcessed, startTime })
      if (!cont.shouldContinue) {
        skippedDueToTimeout = collected.length - totalProcessed
        console.log(`⏭️  Stopping (${cont.reason}) — ${skippedDueToTimeout} items remaining`)
        break
      }

      console.log(`\n[${brand}] Processing cluster (${cluster.size} sources)...`)
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

      try {
        // 3.1 品牌頻率前置檢查（避免浪費 Gemini API 調用）
        const frequencyCheck = await checkBrandFrequency(brand, 24, 3)
        if (frequencyCheck.exceeded) {
          console.log(`[${brand}] 🚫 Brand frequency exceeded (${frequencyCheck.count}/3 in 24h)`)
          console.log(`[${brand}]   Recent: "${frequencyCheck.recentArticles[0]?.title_zh}"`)
          console.log(`[${brand}] → Skipping to save API quota`)
          continue
        }

        // 3.2 生成短ID（需要在圖片存儲前生成）
        const shortId = generateShortId()

        // 3.3 调用AI生成文章
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
        // 優先順序：official（官方新聞室）> news（新聞媒體）> 其他
        const sourceImages: Array<{
          url: string
          credit: string
          caption?: string
          sourceType?: string
          isOfficial?: boolean
        }>  = []
        for (const article of cluster.articles) {
          if (article.image_url) {
            const isOfficial = (article as { source_type?: string }).source_type === 'official'
            sourceImages.push({
              url: article.image_url,
              credit: article.image_credit || 'Unknown',
              caption: article.title.slice(0, 100),
              sourceType: (article as { source_type?: string }).source_type,
              isOfficial,
            })

            // 從 source_images JSONB 欄位收集額外的官方圖片
            const rawSourceImages = article.source_images
            if (rawSourceImages && Array.isArray(rawSourceImages) && rawSourceImages.length > 0) {
              for (const img of rawSourceImages) {
                const imgUrl = img.highResUrl || img.url
                // 避免重複加入已有的 image_url 或已收集的圖片
                if (imgUrl && imgUrl !== article.image_url && !sourceImages.some(s => s.url === imgUrl)) {
                  sourceImages.push({
                    url: imgUrl,
                    credit: img.credit || article.image_credit || 'Unknown',
                    caption: img.caption || article.title.slice(0, 100),
                    sourceType: (article as { source_type?: string }).source_type,
                    isOfficial: true,
                  })
                }
              }
            }
          }
        }

        // 將官方圖片排在前面
        sourceImages.sort((a, b) => {
          if (a.isOfficial && !b.isOfficial) return -1
          if (!a.isOfficial && b.isOfficial) return 1
          return 0
        })

        // 檢查是否有官方圖片
        const hasOfficialImage = sourceImages.some(img => img.isOfficial)
        if (hasOfficialImage) {
          console.log(`[${brand}] → Found official pressroom image!`)
        }

        console.log(`[${brand}] → Found ${sourceImages.length} source images, downloading and storing...`)

        // 3.4.1 下載並存儲圖片到 Supabase Storage
        const storedImages = await downloadAndStoreImages(sourceImages, shortId)
        console.log(`[${brand}] → Successfully stored ${storedImages.length}/${sourceImages.length} images`)

        // 3.4.2 決定封面圖片來源
        let coverImage: string | undefined = undefined
        let imageCredit: string | undefined = undefined

        // 優先順序：1. 來源文章的coverImage  2. 其他已下載的來源圖片  3. AI 生成
        if (generated.coverImage) {
          // 檢查 coverImage 是否來自來源文章
          const matchingSource = sourceImages.find(img => {
            if (img.url === generated.coverImage) return true
            try {
              const sourceHost = new URL(img.url).hostname
              return generated.coverImage?.includes(sourceHost)
            } catch {
              return false
            }
          })

          const credit = matchingSource
            ? matchingSource.credit
            : (generated.imageCredit || 'Unknown')

          console.log(`[${brand}] → Downloading cover image (credit: ${credit})...`)
          const storedCover = await downloadAndStoreImage(
            generated.coverImage,
            shortId,
            credit
          )
          if (storedCover) {
            coverImage = storedCover.url
            imageCredit = storedCover.credit
            console.log(`[${brand}] → ✓ Cover image stored (from: ${matchingSource ? 'source' : 'external'})`)
          } else {
            console.log(`[${brand}] → ✗ Cover image download failed, trying fallback...`)
          }
        }

        // Fallback 1: 使用其他已下載的來源圖片
        if (!coverImage && storedImages.length > 0) {
          coverImage = storedImages[0].url
          imageCredit = storedImages[0].credit
          console.log(`[${brand}] → Using first stored source image as cover`)
        }

        // Fallback 2: AI 生成（僅當完全沒有可用圖片時）
        if (!coverImage) {
          console.log(`[${brand}] → No images available (source: ${sourceImages.length}, stored: ${storedImages.length})`)

          // 成本考量：Flux ($0.008/張) / DALL-E 3 ($0.04/張) vs Gemini 文字 ($0.000675/篇)
          const enableAIGeneration = process.env.ENABLE_AI_IMAGE_GENERATION !== 'false'

          if (enableAIGeneration) {
            console.log(`[${brand}] → Generating AI cover (Flux ~$0.008, DALL-E fallback ~$0.04)...`)
            const aiImage = await generateAndSaveCoverImage(
              generated.title_zh,
              generated.content_zh,
              generated.brands,
              storedImages.length > 0 ? storedImages : undefined
            )

            if (aiImage && aiImage.url) {
              coverImage = aiImage.url
              imageCredit = aiImage.credit
              console.log(`[${brand}] ✓ AI cover image generated and saved`)
            } else {
              console.log(`[${brand}] ✗ AI image generation failed, article will have no cover`)
            }
          } else {
            console.log(`[${brand}] ⏭️  AI image generation disabled, article will have no cover`)
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

        // ============ Social Media Posts ============
        // 為文章建立社群貼文（若剩餘時間足夠）
        const elapsedSoFar = Date.now() - startTime
        if (article && elapsedSoFar < TIMEOUT_CONFIG.MAX_DURATION_MS - 30000) {
          try {
            const socialResult = await createSocialPostsForArticle({
              id: shortId,
              title_zh: generated.title_zh,
              content_zh: generated.content_zh,
              slug_en: generated.slug_en,
              cover_image: coverImage || null
            })
            console.log(`[${brand}] 📱 Social posts: ${socialResult.created} created, ${socialResult.published} published`)
            if (socialResult.errors.length > 0) {
              console.log(`[${brand}] ⚠ Social errors: ${socialResult.errors.join(', ')}`)
            }
          } catch (socialError) {
            console.error(`[${brand}] ⚠ Social post creation failed (non-fatal):`, getErrorMessage(socialError))
          }
        }
        // =============================================

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

        console.log(`[${brand}] ✓ ${decision.shouldPublish ? 'Published' : 'Saved'}: ${generated.title_zh} (${storedImages.length} images stored) [${totalProcessed}/${TIMEOUT_CONFIG.TARGET_ARTICLES}]`)

      } catch (error) {
        console.error(`[${brand}] Error generating article for cluster:`, getErrorMessage(error))
        // 继续处理下一个聚类
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
        raw_articles: rawCount,
        motorcycle_filtered: filteredCount,
        car_articles: carArticles.length,
        brand_groups: brandGroups.size,
        total_clusters: totalClusters,
        articles_generated: results.length,
        articles_published: results.filter(r => r.published).length,
        duration_ms: elapsedTime,
        hit_timeout: hitTimeout,
        timeout_reason: hitTimeout ? (totalProcessed >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN ? 'article_limit' : 'time_limit') : null,
        round_robin: {
          collected: collected.length,
          rounds_completed: roundsCompleted,
          brands_with_clusters: allBrandClusters.length
        },
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
