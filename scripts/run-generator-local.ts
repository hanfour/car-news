/**
 * 本地運行 generator 來測試品牌輪換邏輯
 * 這個腳本會模擬 API route 的完整執行流程，並輸出詳細日誌
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'
import { groupArticlesByBrand, filterCarArticles } from '../src/lib/utils/brand-extractor'
import { clusterArticles } from '../src/lib/ai/clustering'

const PRIORITY_BRANDS = [
  'Tesla', 'BYD', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Chevrolet',
  'Porsche', 'Ferrari', 'Lamborghini', 'NIO', 'XPeng', 'Li Auto'
]

async function runGeneratorLocal() {
  console.log('=== 開始本地 Generator 測試 ===\n')

  const supabase = createServiceClient()

  // 1. 獲取 raw_articles
  console.log('1. 獲取 raw_articles...')
  const { data: rawArticles, error } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (error || !rawArticles) {
    console.error('Error:', error)
    return
  }

  console.log(`   總共 ${rawArticles.length} 篇 raw_articles\n`)

  // 2. 過濾汽車文章
  console.log('2. 過濾汽車文章...')
  const carArticles = filterCarArticles(rawArticles)
  console.log(`   過濾後: ${carArticles.length} 篇汽車文章\n`)

  // 3. 按品牌分組
  console.log('3. 按品牌分組...')
  const brandGroups = groupArticlesByBrand(carArticles)
  console.log(`   找到 ${brandGroups.size} 個品牌組:\n`)

  for (const [brand, articles] of brandGroups.entries()) {
    console.log(`   - ${brand}: ${articles.length} 篇`)
  }
  console.log()

  // 4. 品牌輪換機制
  console.log('4. 品牌輪換機制...')
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const rotationSeed = dayOfYear % PRIORITY_BRANDS.length

  const rotatedPriorityBrands = [
    ...PRIORITY_BRANDS.slice(rotationSeed),
    ...PRIORITY_BRANDS.slice(0, rotationSeed)
  ]

  console.log(`   Day of year: ${dayOfYear}`)
  console.log(`   Rotation seed: ${rotationSeed}`)
  console.log(`   今天的優先順序:`)
  rotatedPriorityBrands.slice(0, 10).forEach((brand, i) => {
    const count = brandGroups.get(brand)?.length || 0
    console.log(`     ${i + 1}. ${brand}: ${count} 篇`)
  })
  console.log()

  // 5. 品牌排序
  console.log('5. 品牌排序...')
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

  console.log('   排序後的處理順序（前10）:')
  sortedBrands.slice(0, 10).forEach(([brand, articles], idx) => {
    const isPriority = rotatedPriorityBrands.includes(brand)
    const priorityIndex = rotatedPriorityBrands.indexOf(brand)
    console.log(`     ${idx + 1}. ${brand}: ${articles.length} 篇 ${isPriority ? `⭐ (優先級 ${priorityIndex + 1})` : ''}`)
  })
  console.log()

  // 6. 測試前3個品牌的聚類
  console.log('6. 測試前3個品牌的聚類...\n')

  for (let i = 0; i < Math.min(3, sortedBrands.length); i++) {
    const [brand, brandArticles] = sortedBrands[i]

    console.log(`\n   [${brand}] 處理 ${brandArticles.length} 篇文章...`)

    // 顯示文章標題
    console.log(`   文章列表:`)
    brandArticles.slice(0, 3).forEach((a, idx) => {
      console.log(`     ${idx + 1}. ${a.title?.substring(0, 70)}`)
    })
    if (brandArticles.length > 3) {
      console.log(`     ... 還有 ${brandArticles.length - 3} 篇`)
    }

    // 嘗試聚類
    let brandClusters = []

    try {
      if (brandArticles.length === 1) {
        console.log(`   → 單篇文章，直接處理`)
        const article = brandArticles[0]
        let centroid = article.embedding
        if (typeof centroid === 'string') {
          centroid = JSON.parse(centroid)
        }
        brandClusters.push({
          articles: [article],
          centroid: centroid,
          size: 1,
          similarity: 1.0
        })
      } else if (brandArticles.length === 2) {
        console.log(`   → 2篇文章，使用高相似度門檻 (0.6)`)
        brandClusters = await clusterArticles(brandArticles, 2, 0.6)
      } else {
        console.log(`   → ${brandArticles.length}篇文章，正常聚類 (min=2, threshold=0.5)`)
        brandClusters = await clusterArticles(brandArticles, 2, 0.5)
      }

      console.log(`   → 找到 ${brandClusters.length} 個主題聚類`)

      if (brandClusters.length === 0 && brandArticles.length >= 2) {
        console.log(`   → 聚類失敗，創建品牌週報`)
        let centroid = brandArticles[0].embedding
        if (typeof centroid === 'string') {
          centroid = JSON.parse(centroid)
        }
        brandClusters.push({
          articles: brandArticles,
          centroid: centroid,
          size: brandArticles.length,
          similarity: 0.5
        })
      }

      // 顯示聚類結果
      brandClusters.forEach((cluster, idx) => {
        console.log(`     Cluster ${idx + 1}: ${cluster.articles.length} 篇文章`)
      })

    } catch (error) {
      console.error(`   ❌ 聚類錯誤:`, error)
    }
  }

  console.log('\n\n=== 測試完成 ===')
  console.log('\n分析結果:')
  console.log(`- 品牌輪換機制: ${rotatedPriorityBrands[0] === sortedBrands[0][0] ? '✅ 生效' : '❌ 失效'}`)
  console.log(`- 第一優先品牌: ${rotatedPriorityBrands[0]} (${brandGroups.get(rotatedPriorityBrands[0])?.length || 0} 篇)`)
  console.log(`- 實際處理順序第一: ${sortedBrands[0][0]} (${sortedBrands[0][1].length} 篇)`)

  if (rotatedPriorityBrands[0] !== sortedBrands[0][0]) {
    console.log('\n⚠️  品牌輪換失效！需要檢查排序邏輯')
    console.log(`   預期第一: ${rotatedPriorityBrands[0]}`)
    console.log(`   實際第一: ${sortedBrands[0][0]}`)
  }
}

runGeneratorLocal().catch(console.error)
