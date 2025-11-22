import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'
import { groupArticlesByBrand, filterCarArticles } from '../src/lib/utils/brand-extractor'

async function debugGenerator() {
  const supabase = createServiceClient()

  console.log('=== 1. 檢查 raw_articles 數據 ===')

  // 獲取所有未過期的 raw_articles
  const { data: rawArticles, error } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (error || !rawArticles) {
    console.error('Error:', error)
    return
  }

  console.log(`總 raw_articles: ${rawArticles.length}`)

  // 過濾汽車文章
  const carArticles = filterCarArticles(rawArticles)
  console.log(`過濾後汽車文章: ${carArticles.length}`)

  // 按品牌分組
  const brandGroups = groupArticlesByBrand(carArticles)

  console.log('\n=== 2. 品牌分布 ===')
  const brandStats = Array.from(brandGroups.entries())
    .map(([brand, articles]) => ({ brand, count: articles.length }))
    .sort((a, b) => b.count - a.count)

  brandStats.forEach(({ brand, count }) => {
    console.log(`${brand}: ${count} 篇`)
  })

  console.log('\n=== 3. 檢查已生成文章 ===')

  // 檢查最近生成的文章
  const { data: recentGenerated } = await supabase
    .from('generated_articles')
    .select('brand, title_zh, created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  if (recentGenerated) {
    const generatedByBrand = new Map<string, number>()
    recentGenerated.forEach(a => {
      const brand = a.brand || 'Unknown'
      generatedByBrand.set(brand, (generatedByBrand.get(brand) || 0) + 1)
    })

    console.log('最近7天已生成文章（按品牌）:')
    Array.from(generatedByBrand.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([brand, count]) => {
        console.log(`  ${brand}: ${count} 篇`)
      })

    console.log('\n最近10篇生成的文章:')
    recentGenerated.slice(0, 10).forEach(a => {
      console.log(`  [${a.brand}] ${a.title_zh}`)
    })
  }

  console.log('\n=== 4. 模擬品牌輪換邏輯 ===')

  const PRIORITY_BRANDS = [
    'Tesla', 'BYD', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
    'Toyota', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Chevrolet',
    'Porsche', 'Ferrari', 'Lamborghini', 'NIO', 'XPeng', 'Li Auto'
  ]

  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const rotationSeed = dayOfYear % PRIORITY_BRANDS.length

  const rotatedPriorityBrands = [
    ...PRIORITY_BRANDS.slice(rotationSeed),
    ...PRIORITY_BRANDS.slice(0, rotationSeed)
  ]

  console.log(`Day of year: ${dayOfYear}`)
  console.log(`Rotation seed: ${rotationSeed}`)
  console.log(`今天的品牌優先順序（前10）:`)
  rotatedPriorityBrands.slice(0, 10).forEach((brand, i) => {
    const count = brandGroups.get(brand)?.length || 0
    console.log(`  ${i + 1}. ${brand}: ${count} 篇 raw_articles`)
  })

  console.log('\n=== 5. 檢查可能的問題 ===')

  // 檢查是否有品牌文章數量為 0
  const zeroBrands = rotatedPriorityBrands.slice(0, 10).filter(brand => {
    const count = brandGroups.get(brand)?.length || 0
    return count === 0
  })

  if (zeroBrands.length > 0) {
    console.log('⚠️  以下優先品牌沒有 raw_articles:')
    zeroBrands.forEach(brand => console.log(`  - ${brand}`))
  }

  // 檢查 Tesla 是否過多
  const teslaCount = brandGroups.get('Tesla')?.length || 0
  const totalCount = carArticles.length
  const teslaPercentage = (teslaCount / totalCount * 100).toFixed(1)

  if (teslaCount > 100) {
    console.log(`⚠️  Tesla 文章數量過多: ${teslaCount} 篇 (${teslaPercentage}%)`)
  }
}

debugGenerator().catch(console.error)
