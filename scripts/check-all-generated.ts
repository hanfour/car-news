import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'

async function check() {
  const supabase = createServiceClient()

  console.log('=== 檢查 generated_articles 表 ===\n')

  // 檢查所有文章
  const { data: all, count } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50)

  console.log('資料庫中總文章數:', count)

  if (!all || all.length === 0) {
    console.log('❌ 資料庫完全沒有文章！')
    return
  }

  // 按品牌分組
  const byBrand = new Map<string, number>()
  all.forEach(a => {
    const brand = a.brand || 'Unknown'
    byBrand.set(brand, (byBrand.get(brand) || 0) + 1)
  })

  console.log('\n品牌分布（最近50篇，使用 primary_brand）:')
  const byPrimaryBrand = new Map<string, number>()
  all.forEach(a => {
    const brand = a.primary_brand || 'null'
    byPrimaryBrand.set(brand, (byPrimaryBrand.get(brand) || 0) + 1)
  })

  Array.from(byPrimaryBrand.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => {
      console.log(`  ${brand}: ${count} 篇`)
    })

  console.log('\n最新10篇:')
  all.slice(0, 10).forEach(a => {
    const date = new Date(a.created_at).toLocaleString('zh-TW')
    console.log(`  [${date}] [${a.brand}] ${a.title_zh}`)
  })

  console.log('\n最舊10篇:')
  all.slice(-10).reverse().forEach(a => {
    const date = new Date(a.created_at).toLocaleString('zh-TW')
    console.log(`  [${date}] [${a.brand}] ${a.title_zh}`)
  })
}

check().catch(console.error)
