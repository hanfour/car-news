/**
 * 批次回溯爬取歷史文章腳本（10/1 - 11/19）
 *
 * 功能：
 * 1. 從所有新聞源 RSS Feed 中爬取歷史文章
 * 2. 過濾出 2024/10/1 - 2024/11/19 之間的文章
 * 3. 保存到資料庫並生成 embedding
 *
 * 注意事項：
 * - RSS Feed 通常只保留最近 30-60 天的文章
 * - 某些來源可能無法提供 10/1 之前的文章
 * - 執行時間約 1-2 小時（視文章數量而定）
 * - 建議在本地或開發環境執行，避免 Vercel 超時
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { scrapeAllSources } from '@/lib/scraper'
import { generateEmbedding } from '@/lib/ai/embeddings'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 日期範圍：2025/10/1 - 2025/11/19
const START_DATE = new Date('2025-10-01T00:00:00Z')
const END_DATE = new Date('2025-11-19T23:59:59Z')

async function backfillHistoricalArticles() {
  console.log('\n🕒 ===== 批次回溯爬取歷史文章 =====\n')
  console.log(`日期範圍：${START_DATE.toLocaleDateString('zh-TW')} - ${END_DATE.toLocaleDateString('zh-TW')}`)
  console.log('')

  const startTime = Date.now()
  let totalScraped = 0
  let totalSaved = 0
  let totalSkipped = 0
  let totalFiltered = 0

  try {
    // 1. 爬取所有新聞源
    console.log('1️⃣  開始爬取新聞源...')
    const articles = await scrapeAllSources()
    console.log(`   ✓ 爬取到 ${articles.length} 篇文章\n`)

    totalScraped = articles.length

    if (articles.length === 0) {
      console.log('⚠️  沒有爬取到任何文章')
      return
    }

    // 2. 過濾日期範圍（10/1 - 11/19）
    console.log('2️⃣  過濾日期範圍...')
    const filteredArticles = articles.filter(article => {
      if (!article.publishedAt) {
        return false // 沒有發布時間的文章忽略
      }
      const pubDate = new Date(article.publishedAt)
      return pubDate >= START_DATE && pubDate <= END_DATE
    })

    totalFiltered = articles.length - filteredArticles.length
    console.log(`   ✓ 符合日期範圍的文章：${filteredArticles.length} 篇`)
    console.log(`   ✓ 過濾掉：${totalFiltered} 篇（不在日期範圍或無發布時間）\n`)

    if (filteredArticles.length === 0) {
      console.log('⚠️  沒有符合日期範圍的文章')
      return
    }

    // 3. 檢查重複（批次查詢）
    console.log('3️⃣  檢查重複文章...')
    const urls = filteredArticles.map(a => a.url)
    const { data: existingArticles, error: checkError } = await supabase
      .from('raw_articles')
      .select('url')
      .in('url', urls)

    if (checkError) {
      console.error('   ⚠️  檢查重複時發生錯誤：', checkError)
    }

    const existingUrls = new Set(existingArticles?.map(a => a.url) || [])
    console.log(`   ✓ 發現 ${existingUrls.size} 篇已存在的文章\n`)

    // 4. 準備保存的文章
    console.log('4️⃣  準備保存文章...')
    const articlesToSave = []
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90天過期

    for (const article of filteredArticles) {
      if (existingUrls.has(article.url)) {
        totalSkipped++
        continue
      }

      articlesToSave.push({
        url: article.url,
        title: article.title,
        content: article.content,
        scraped_at: new Date().toISOString(),
        source_published_at: article.publishedAt?.toISOString() || null,
        expires_at: expiresAt,
        embedding: null, // 延遲生成（generator 中處理）
        image_url: article.imageUrl || null,
        image_credit: article.source || null
      })
    }

    console.log(`   ✓ 準備保存 ${articlesToSave.length} 篇新文章\n`)

    // 5. 批次保存（分批處理，避免一次性插入過多）
    console.log('5️⃣  批次保存到資料庫...')
    const BATCH_SIZE = 50
    let savedCount = 0

    for (let i = 0; i < articlesToSave.length; i += BATCH_SIZE) {
      const batch = articlesToSave.slice(i, i + BATCH_SIZE)

      const { error: insertError } = await supabase
        .from('raw_articles')
        .insert(batch)

      if (insertError) {
        console.error(`   ⚠️  批次 ${Math.floor(i / BATCH_SIZE) + 1} 保存失敗：`, insertError)
      } else {
        savedCount += batch.length
        console.log(`   ✓ 已保存 ${savedCount}/${articlesToSave.length} 篇文章`)
      }
    }

    totalSaved = savedCount
    console.log('')

    // 6. 統計報告
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n✅ ===== 完成 =====\n')
    console.log(`總計爬取：${totalScraped} 篇`)
    console.log(`日期過濾：${totalFiltered} 篇（不在範圍內）`)
    console.log(`重複跳過：${totalSkipped} 篇`)
    console.log(`成功保存：${totalSaved} 篇`)
    console.log(`執行時間：${duration} 秒\n`)

    // 7. 按日期統計
    console.log('📊 按發布日期統計：')
    const dateStats = new Map<string, number>()

    for (const article of articlesToSave) {
      if (article.source_published_at) {
        const date = article.source_published_at.split('T')[0]
        dateStats.set(date, (dateStats.get(date) || 0) + 1)
      }
    }

    const sortedDates = Array.from(dateStats.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    sortedDates.forEach(([date, count]) => {
      console.log(`   ${date}: ${count} 篇`)
    })

    console.log('\n下一步：')
    console.log('  1. 運行生成器：npx tsx scripts/run-generator.ts')
    console.log('  2. 檢查生成結果：npx tsx scripts/check-recent-articles.ts\n')

  } catch (error) {
    console.error('\n❌ 發生錯誤：', error)
    process.exit(1)
  }
}

// 執行
backfillHistoricalArticles()
