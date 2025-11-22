/**
 * 診斷為什麼 Mercedes-Benz/BMW/Audi 文章沒有被生成
 * 檢查相似度過濾是否過於嚴格
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

async function diagnose() {
  const supabase = createServiceClient()

  console.log('=== 1. 檢查最近7天生成的文章 ===\n')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: recentGenerated } = await supabase
    .from('generated_articles')
    .select('brand, title_zh, title_en, created_at, embedding')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (!recentGenerated || recentGenerated.length === 0) {
    console.log('❌ 最近7天沒有生成任何文章')
    return
  }

  const byBrand = new Map<string, number>()
  recentGenerated.forEach(a => {
    const brand = a.brand || 'Unknown'
    byBrand.set(brand, (byBrand.get(brand) || 0) + 1)
  })

  console.log('最近7天已生成文章（按品牌）:')
  Array.from(byBrand.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => {
      console.log(`  ${brand}: ${count} 篇`)
    })

  console.log('\n最新10篇:')
  recentGenerated.slice(0, 10).forEach(a => {
    const date = new Date(a.created_at).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    console.log(`  [${date}] [${a.brand}] ${a.title_zh}`)
  })

  console.log('\n=== 2. 檢查優先品牌的 raw_articles ===\n')

  const { data: rawArticles } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (!rawArticles) {
    console.log('❌ 沒有 raw_articles')
    return
  }

  const carArticles = filterCarArticles(rawArticles)
  const brandGroups = groupArticlesByBrand(carArticles)

  // 品牌輪換
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const rotationSeed = dayOfYear % PRIORITY_BRANDS.length

  const rotatedPriorityBrands = [
    ...PRIORITY_BRANDS.slice(rotationSeed),
    ...PRIORITY_BRANDS.slice(0, rotationSeed)
  ]

  console.log(`今天的品牌優先順序 (day ${dayOfYear}, seed ${rotationSeed}):`)
  rotatedPriorityBrands.slice(0, 5).forEach((brand, i) => {
    const count = brandGroups.get(brand)?.length || 0
    console.log(`  ${i + 1}. ${brand}: ${count} 篇 raw_articles`)
  })

  console.log('\n=== 3. 測試相似度檢查 ===\n')

  // 測試前3個優先品牌
  for (let i = 0; i < Math.min(3, rotatedPriorityBrands.length); i++) {
    const brand = rotatedPriorityBrands[i]
    const articles = brandGroups.get(brand) || []

    console.log(`\n[${brand}] 測試 ${articles.length} 篇 raw_articles`)

    if (articles.length === 0) {
      console.log('  ⚠️  沒有文章')
      continue
    }

    // 顯示前3篇
    console.log('  文章列表:')
    articles.slice(0, 3).forEach((a, idx) => {
      console.log(`    ${idx + 1}. ${a.title?.substring(0, 70)}`)
    })

    // 取第一篇測試相似度
    const testArticle = articles[0]

    console.log(`\n  測試文章: "${testArticle.title?.substring(0, 70)}"`)
    console.log(`  檢查是否與已生成的文章相似...`)

    // 獲取這個品牌最近生成的文章
    const brandGenerated = recentGenerated.filter(a => a.brand === brand)

    if (brandGenerated.length === 0) {
      console.log(`  ✅ 沒有已生成的 ${brand} 文章，應該可以生成`)
      continue
    }

    console.log(`  發現 ${brandGenerated.length} 篇已生成的 ${brand} 文章`)

    // 檢查 embedding
    let testEmbedding = testArticle.embedding
    if (typeof testEmbedding === 'string') {
      testEmbedding = JSON.parse(testEmbedding)
    }

    if (!testEmbedding || !Array.isArray(testEmbedding)) {
      console.log('  ⚠️  測試文章沒有 embedding，跳過')
      continue
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
      console.log(`\n  最相似的已生成文章:`)
      console.log(`    標題: "${mostSimilarArticle.title_zh}"`)
      console.log(`    相似度: ${(maxSimilarity * 100).toFixed(1)}%`)

      if (maxSimilarity >= 0.92) {
        console.log(`    ❌ 相似度 >= 92%，會被過濾掉`)
      } else if (maxSimilarity >= 0.85) {
        console.log(`    ⚠️  相似度 >= 85%，舊閾值會過濾，新閾值不會`)
      } else {
        console.log(`    ✅ 相似度 < 85%，應該可以生成`)
      }
    }
  }

  console.log('\n=== 4. 診斷結論 ===\n')

  const teslaCount = byBrand.get('Tesla') || 0
  const mercedesCount = byBrand.get('Mercedes-Benz') || 0
  const bmwCount = byBrand.get('BMW') || 0
  const audiCount = byBrand.get('Audi') || 0

  console.log(`最近7天生成文章統計:`)
  console.log(`  Tesla: ${teslaCount} 篇`)
  console.log(`  Mercedes-Benz: ${mercedesCount} 篇`)
  console.log(`  BMW: ${bmwCount} 篇`)
  console.log(`  Audi: ${audiCount} 篇`)

  if (teslaCount > 10 && mercedesCount === 0 && bmwCount === 0 && audiCount === 0) {
    console.log('\n🔴 問題確認: 只有 Tesla 文章，其他品牌為 0')
    console.log('\n可能原因:')
    console.log('  1. 相似度閾值過低，其他品牌文章被過濾')
    console.log('  2. 品牌輪換邏輯在 Vercel 上沒有生效')
    console.log('  3. 其他品牌的 raw_articles 沒有 embedding')
  }
}

diagnose().catch(console.error)
