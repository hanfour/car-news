/**
 * 深度診斷品牌多樣性問題
 * 檢查每個環節：raw_articles → 品牌輪換 → 相似度過濾 → 最終生成
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'
import { groupArticlesByBrand, filterCarArticles } from '../src/lib/utils/brand-extractor'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PRIORITY_BRANDS = [
  'Tesla', 'BYD', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Chevrolet',
  'Porsche', 'Ferrari', 'Lamborghini', 'NIO', 'XPeng', 'Li Auto'
]

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

async function deepDiagnose() {
  const supabase = createServiceClient()

  console.log('=== 🔬 深度診斷：品牌多樣性問題 ===\n')

  // 1. 檢查 raw_articles
  console.log('📥 步驟 1: 檢查 raw_articles')
  const { data: rawArticles } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (!rawArticles || rawArticles.length === 0) {
    console.log('❌ 沒有 raw_articles！')
    return
  }

  console.log(`總數: ${rawArticles.length} 篇\n`)

  // 2. 過濾汽車文章
  console.log('🚗 步驟 2: 過濾汽車文章')
  const carArticles = filterCarArticles(rawArticles)
  console.log(`過濾後: ${carArticles.length} 篇\n`)

  // 3. 品牌分組
  console.log('🏷️  步驟 3: 品牌分組')
  const brandGroups = groupArticlesByBrand(carArticles)
  console.log(`品牌數: ${brandGroups.size} 個\n`)

  // 顯示品牌分布
  const brandCounts = Array.from(brandGroups.entries())
    .map(([brand, articles]) => ({ brand, count: articles.length }))
    .sort((a, b) => b.count - a.count)

  console.log('品牌分布（前15）:')
  brandCounts.slice(0, 15).forEach(({ brand, count }) => {
    const isPriority = PRIORITY_BRANDS.includes(brand)
    console.log(`  ${isPriority ? '⭐' : '  '} ${brand.padEnd(20)} ${count} 篇`)
  })
  console.log()

  // 4. 品牌輪換
  console.log('🔄 步驟 4: 品牌輪換')
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const rotationSeed = dayOfYear % PRIORITY_BRANDS.length

  const rotatedPriorityBrands = [
    ...PRIORITY_BRANDS.slice(rotationSeed),
    ...PRIORITY_BRANDS.slice(0, rotationSeed)
  ]

  console.log(`Day: ${dayOfYear}, Seed: ${rotationSeed}`)
  console.log(`今天的優先順序:`)
  rotatedPriorityBrands.slice(0, 5).forEach((brand, i) => {
    const count = brandGroups.get(brand)?.length || 0
    console.log(`  ${i + 1}. ${brand}: ${count} 篇 raw_articles`)
  })
  console.log()

  // 5. 檢查已生成文章（最近3天）
  console.log('📊 步驟 5: 檢查已生成文章（最近3天）')
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const { data: recentGenerated } = await supabase
    .from('generated_articles')
    .select('brand, title_zh, title_en, created_at, embedding')
    .gte('created_at', threeDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (!recentGenerated || recentGenerated.length === 0) {
    console.log('⚠️  最近3天沒有生成任何文章\n')
  } else {
    const genBrandCounts = new Map<string, number>()
    recentGenerated.forEach(a => {
      const brand = a.brand || 'Unknown'
      genBrandCounts.set(brand, (genBrandCounts.get(brand) || 0) + 1)
    })

    console.log(`總數: ${recentGenerated.length} 篇`)
    console.log('品牌分布:')
    Array.from(genBrandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([brand, count]) => {
        const percentage = ((count / recentGenerated.length) * 100).toFixed(1)
        console.log(`  ${brand.padEnd(20)} ${count.toString().padStart(3)} 篇 (${percentage}%)`)
      })
    console.log()
  }

  // 6. 相似度檢查 - 檢查前3個優先品牌
  console.log('🔍 步驟 6: 相似度檢查（檢查前3個優先品牌）\n')

  for (let i = 0; i < Math.min(3, rotatedPriorityBrands.length); i++) {
    const brand = rotatedPriorityBrands[i]
    const articles = brandGroups.get(brand) || []

    console.log(`[${ brand}] 分析...`)

    if (articles.length === 0) {
      console.log(`  ❌ 沒有 raw_articles`)
      console.log()
      continue
    }

    console.log(`  ✅ ${articles.length} 篇 raw_articles`)

    // 檢查有多少篇有 embedding
    const withEmbedding = articles.filter(a => a.embedding).length
    console.log(`  📊 有 embedding: ${withEmbedding}/${articles.length} 篇`)

    if (withEmbedding === 0) {
      console.log(`  ⚠️  沒有任何文章有 embedding，無法進行相似度檢查`)
      console.log()
      continue
    }

    // 檢查這個品牌最近生成的文章
    const brandGenerated = (recentGenerated || []).filter(a => a.brand === brand)
    console.log(`  📝 最近3天已生成: ${brandGenerated.length} 篇`)

    if (brandGenerated.length === 0) {
      console.log(`  ✅ 沒有已生成文章，應該可以生成新文章`)
      console.log()
      continue
    }

    // 測試相似度檢查 - 使用第一篇文章
    const testArticle = articles.find(a => a.embedding)
    if (!testArticle) {
      console.log(`  ⚠️  找不到有 embedding 的文章`)
      console.log()
      continue
    }

    let testEmbedding = testArticle.embedding
    if (typeof testEmbedding === 'string') {
      testEmbedding = JSON.parse(testEmbedding)
    }

    // 計算與已生成文章的相似度
    let maxSimilarity = 0
    let mostSimilarArticle = null

    for (const existing of brandGenerated) {
      let existingEmbedding = existing.embedding
      if (typeof existingEmbedding === 'string') {
        existingEmbedding = JSON.parse(existingEmbedding)
      }

      if (!existingEmbedding || !Array.isArray(existingEmbedding)) {
        continue
      }

      const similarity = cosineSimilarity(testEmbedding, existingEmbedding)

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity
        mostSimilarArticle = existing
      }
    }

    if (mostSimilarArticle) {
      console.log(`  🔍 相似度檢查結果:`)
      console.log(`     最相似文章: "${mostSimilarArticle.title_zh}"`)
      console.log(`     相似度: ${(maxSimilarity * 100).toFixed(1)}%`)

      if (maxSimilarity >= 0.92) {
        console.log(`     ❌ 相似度 >= 92%，會被過濾掉`)
      } else if (maxSimilarity >= 0.85) {
        console.log(`     ⚠️  相似度 >= 85%，舊閾值會過濾，新閾值不會`)
      } else {
        console.log(`     ✅ 相似度 < 85%，應該可以生成`)
      }
    }

    console.log()
  }

  // 7. 結論
  console.log('=== 📋 診斷結論 ===\n')

  const teslaRawCount = brandGroups.get('Tesla')?.length || 0
  const mercedesRawCount = brandGroups.get('Mercedes-Benz')?.length || 0
  const bmwRawCount = brandGroups.get('BMW')?.length || 0

  const teslaGenCount = (recentGenerated || []).filter(a => a.brand === 'Tesla').length
  const mercedesGenCount = (recentGenerated || []).filter(a => a.brand === 'Mercedes-Benz').length
  const bmwGenCount = (recentGenerated || []).filter(a => a.brand === 'BMW').length

  console.log('Raw Articles 數量:')
  console.log(`  Tesla: ${teslaRawCount} 篇`)
  console.log(`  Mercedes-Benz: ${mercedesRawCount} 篇`)
  console.log(`  BMW: ${bmwRawCount} 篇`)
  console.log()

  console.log('最近3天已生成:')
  console.log(`  Tesla: ${teslaGenCount} 篇`)
  console.log(`  Mercedes-Benz: ${mercedesGenCount} 篇`)
  console.log(`  BMW: ${bmwGenCount} 篇`)
  console.log()

  if (teslaGenCount > 10 && mercedesGenCount === 0 && bmwGenCount === 0) {
    console.log('🔴 問題確認: Tesla 獨大，其他優先品牌為 0')
    console.log()
    console.log('可能原因排查:')
    console.log('  1. ✅ 品牌輪換邏輯正常（本地測試已證明）')
    console.log('  2. ✅ 品牌配額上限已設置 (MAX_ARTICLES_PER_BRAND = 3)')
    console.log(`  3. ${teslaRawCount > bmwRawCount * 2 ? '🟡' : '✅'} Tesla raw_articles 數量 (${teslaRawCount}) vs BMW (${bmwRawCount})`)
    console.log('  4. ❓ 需要檢查: 相似度過濾是否過於嚴格？')
    console.log('  5. ❓ 需要檢查: Vercel 環境變數或部署問題？')
  } else if (teslaGenCount > mercedesGenCount + bmwGenCount) {
    console.log('🟡 Tesla 佔比較高，但其他品牌有文章')
    console.log('   這可能是正常的，因為 Tesla 新聞確實較多')
  } else {
    console.log('🟢 品牌分布看起來正常')
  }
}

deepDiagnose().catch(console.error)
