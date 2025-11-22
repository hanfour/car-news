import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'
import { groupArticlesByBrand, filterCarArticles } from '../src/lib/utils/brand-extractor'

const PRIORITY_BRANDS = [
  'Tesla', 'BYD', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Chevrolet',
  'Porsche', 'Ferrari', 'Lamborghini', 'NIO', 'XPeng', 'Li Auto'
]

async function testFlow() {
  const supabase = createServiceClient()

  console.log('=== 1. 獲取 raw_articles ===')
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
  console.log(`過濾後汽車文章: ${carArticles.length}\n`)

  // 按品牌分組
  const brandGroups = groupArticlesByBrand(carArticles)

  console.log('=== 2. 品牌輪換邏輯 ===')
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const rotationSeed = dayOfYear % PRIORITY_BRANDS.length

  const rotatedPriorityBrands = [
    ...PRIORITY_BRANDS.slice(rotationSeed),
    ...PRIORITY_BRANDS.slice(0, rotationSeed)
  ]

  console.log(`Day of year: ${dayOfYear}`)
  console.log(`Rotation seed: ${rotationSeed}`)
  console.log(`今天的優先順序:`)
  rotatedPriorityBrands.slice(0, 10).forEach((brand, i) => {
    const count = brandGroups.get(brand)?.length || 0
    console.log(`  ${i + 1}. ${brand}: ${count} 篇`)
  })

  console.log('\n=== 3. 檢查前3個優先品牌的文章 ===')
  for (let i = 0; i < 3; i++) {
    const brand = rotatedPriorityBrands[i]
    const articles = brandGroups.get(brand) || []

    console.log(`\n[${brand}] ${articles.length} 篇文章:`)
    if (articles.length === 0) {
      console.log('  ⚠️  沒有文章')
      continue
    }

    articles.slice(0, 3).forEach(a => {
      console.log(`  - ${a.title?.substring(0, 70)}`)
      console.log(`    來源: ${a.source_name}`)
      console.log(`    發布時間: ${a.published_at}`)
    })

    if (articles.length > 3) {
      console.log(`  ... 還有 ${articles.length - 3} 篇`)
    }
  }

  console.log('\n=== 4. 檢查已生成的文章（最近1天）===')
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: recentGenerated } = await supabase
    .from('generated_articles')
    .select('brand, title_zh, created_at')
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: false })

  if (recentGenerated && recentGenerated.length > 0) {
    const byBrand = new Map<string, number>()
    recentGenerated.forEach(a => {
      const brand = a.brand || 'Unknown'
      byBrand.set(brand, (byBrand.get(brand) || 0) + 1)
    })

    console.log('最近1天已生成（按品牌）:')
    Array.from(byBrand.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([brand, count]) => {
        console.log(`  ${brand}: ${count} 篇`)
      })

    console.log('\n最近5篇:')
    recentGenerated.slice(0, 5).forEach(a => {
      console.log(`  [${a.brand}] ${a.title_zh}`)
    })
  } else {
    console.log('最近1天沒有生成任何文章')
  }
}

testFlow().catch(console.error)
