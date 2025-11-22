/**
 * Generator 監控腳本
 * 用途：
 * 1. 檢查最近生成的文章（品牌分布、時間等）
 * 2. 驗證品牌配額上限是否生效
 * 3. 監控系統健康狀態
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'

async function monitor() {
  const supabase = createServiceClient()

  console.log('=== 🔍 Generator 監控面板 ===\n')
  console.log(`檢查時間: ${new Date().toLocaleString('zh-TW')}\n`)

  // 1. 檢查最近1小時的文章
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const { data: lastHour } = await supabase
    .from('generated_articles')
    .select('brand, title_zh, created_at')
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false })

  console.log('📈 最近1小時生成的文章:')
  if (!lastHour || lastHour.length === 0) {
    console.log('  ❌ 沒有新文章\n')
  } else {
    const brandCount = new Map<string, number>()
    lastHour.forEach(a => {
      const brand = a.brand || 'Unknown'
      brandCount.set(brand, (brandCount.get(brand) || 0) + 1)
    })

    console.log(`  總數: ${lastHour.length} 篇`)
    console.log('  品牌分布:')
    Array.from(brandCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([brand, count]) => {
        const icon = count > 3 ? '🔴' : count === 3 ? '🟡' : '🟢'
        console.log(`    ${icon} ${brand}: ${count} 篇 ${count > 3 ? '(超過配額上限！)' : ''}`)
      })

    console.log('\n  最新5篇:')
    lastHour.slice(0, 5).forEach(a => {
      const time = new Date(a.created_at).toLocaleTimeString('zh-TW')
      console.log(`    [${time}] [${a.brand}] ${a.title_zh?.substring(0, 50)}`)
    })
    console.log()
  }

  // 2. 檢查最近24小時的文章
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: last24h } = await supabase
    .from('generated_articles')
    .select('brand, created_at')
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: false })

  console.log('📊 最近24小時品牌分布:')
  if (!last24h || last24h.length === 0) {
    console.log('  ❌ 沒有文章\n')
  } else {
    const brandCount = new Map<string, number>()
    last24h.forEach(a => {
      const brand = a.brand || 'Unknown'
      brandCount.set(brand, (brandCount.get(brand) || 0) + 1)
    })

    console.log(`  總數: ${last24h.length} 篇`)
    Array.from(brandCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([brand, count]) => {
        const percentage = ((count / last24h.length) * 100).toFixed(1)
        const bar = '█'.repeat(Math.floor(count / 2))
        console.log(`    ${brand.padEnd(15)} ${count.toString().padStart(3)} 篇 (${percentage}%) ${bar}`)
      })
    console.log()
  }

  // 3. 檢查總體統計
  const { data: all, count: totalCount } = await supabase
    .from('generated_articles')
    .select('brand', { count: 'exact' })

  console.log('📚 資料庫總統計:')
  console.log(`  總文章數: ${totalCount}\n`)

  // 4. 檢查 raw_articles 待處理數量
  const { data: rawArticles } = await supabase
    .from('raw_articles')
    .select('brand, title')
    .gt('expires_at', new Date().toISOString())

  if (rawArticles) {
    const rawBrandCount = new Map<string, number>()
    rawArticles.forEach(a => {
      const brand = a.brand || 'Other'
      rawBrandCount.set(brand, (rawBrandCount.get(brand) || 0) + 1)
    })

    console.log('📥 Raw Articles 待處理:')
    console.log(`  總數: ${rawArticles.length} 篇`)
    console.log('  前10品牌:')
    Array.from(rawBrandCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([brand, count]) => {
        console.log(`    ${brand.padEnd(15)} ${count} 篇`)
      })
    console.log()
  }

  // 5. 系統健康檢查
  console.log('🏥 系統健康檢查:')

  // 檢查是否有品牌多樣性
  if (last24h && last24h.length > 0) {
    const brandCount = new Map<string, number>()
    last24h.forEach(a => {
      const brand = a.brand || 'Unknown'
      brandCount.set(brand, (brandCount.get(brand) || 0) + 1)
    })

    const uniqueBrands = brandCount.size
    const totalArticles = last24h.length
    const teslaCount = brandCount.get('Tesla') || 0
    const teslaPercentage = (teslaCount / totalArticles) * 100

    console.log(`  品牌多樣性: ${uniqueBrands} 個不同品牌`)

    if (teslaPercentage > 80) {
      console.log(`  🔴 警告: Tesla 佔比過高 (${teslaPercentage.toFixed(1)}%)`)
      console.log(`  ⚠️  品牌配額上限可能未生效`)
    } else if (teslaPercentage > 50) {
      console.log(`  🟡 注意: Tesla 佔比偏高 (${teslaPercentage.toFixed(1)}%)`)
    } else {
      console.log(`  🟢 健康: Tesla 佔比正常 (${teslaPercentage.toFixed(1)}%)`)
    }

    // 檢查品牌配額上限
    const brandsOverQuota = Array.from(brandCount.entries())
      .filter(([_, count]) => count > 3)

    if (brandsOverQuota.length > 0) {
      console.log(`  🔴 警告: 以下品牌超過配額上限 (3篇/次):`)
      brandsOverQuota.forEach(([brand, count]) => {
        console.log(`    - ${brand}: ${count} 篇`)
      })
    } else {
      console.log(`  🟢 品牌配額上限: 正常`)
    }
  }

  console.log('\n=== 監控完成 ===')
}

monitor().catch(console.error)
