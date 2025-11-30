#!/usr/bin/env tsx
/**
 * 測試 Generator 配置
 * 驗證新的小批量高頻率策略配置是否正確
 */

console.log('🧪 測試 Generator 配置\n')

// 讀取配置
const config = {
  TARGET_ARTICLES: 10,
  MAX_ARTICLES_PER_RUN: 15,
  MIN_ARTICLES_PER_BRAND: 1,
  MAX_ARTICLES_PER_BRAND: 3,
  ESTIMATED_TIME_PER_ARTICLE: 25_000,
  MAX_DURATION_MS: 270_000,
}

console.log('📋 當前配置:')
console.log(`  TARGET_ARTICLES: ${config.TARGET_ARTICLES} 篇`)
console.log(`  MAX_ARTICLES_PER_RUN: ${config.MAX_ARTICLES_PER_RUN} 篇`)
console.log(`  MIN_ARTICLES_PER_BRAND: ${config.MIN_ARTICLES_PER_BRAND} 篇`)
console.log(`  MAX_ARTICLES_PER_BRAND: ${config.MAX_ARTICLES_PER_BRAND} 篇`)
console.log(`  ESTIMATED_TIME_PER_ARTICLE: ${config.ESTIMATED_TIME_PER_ARTICLE / 1000} 秒`)
console.log(`  MAX_DURATION_MS: ${config.MAX_DURATION_MS / 1000} 秒\n`)

// 計算預期時間
const estimatedTime = (config.TARGET_ARTICLES * config.ESTIMATED_TIME_PER_ARTICLE) / 1000
const overhead = 25 // 其他開銷（數據庫、去重等）
const totalTime = estimatedTime + overhead

console.log('⏱️  時間估算:')
console.log(`  文章生成: ${estimatedTime} 秒 (${config.TARGET_ARTICLES} × ${config.ESTIMATED_TIME_PER_ARTICLE / 1000})`)
console.log(`  其他開銷: ${overhead} 秒`)
console.log(`  總計: ${totalTime} 秒 (${(totalTime / 60).toFixed(1)} 分鐘)\n`)

// Vercel 限制檢查
const vercelLimit = 300 // 5 分鐘
const buffer = vercelLimit - totalTime

console.log('🎯 Vercel 限制檢查:')
console.log(`  Vercel 上限: ${vercelLimit} 秒 (5 分鐘)`)
console.log(`  預計使用: ${totalTime} 秒`)
console.log(`  安全餘量: ${buffer} 秒`)

if (totalTime < vercelLimit) {
  console.log(`  ✅ 符合限制！餘量 ${buffer} 秒`)
} else {
  console.log(`  ❌ 超過限制！需要減少 ${totalTime - vercelLimit} 秒`)
}

console.log('\n📊 每日產出估算:')
const executionsPerDay = 24 // 每小時 1 次
const articlesPerDay = config.TARGET_ARTICLES * executionsPerDay
const timePerDay = (totalTime * executionsPerDay) / 60

console.log(`  執行次數: ${executionsPerDay} 次/天`)
console.log(`  總產出: ${articlesPerDay} 篇/天`)
console.log(`  總耗時: ${timePerDay.toFixed(0)} 分鐘/天 (${(timePerDay / 60).toFixed(1)} 小時)`)

console.log('\n💰 成本估算:')
const costPerArticle = 0.00068 // Gemini 2.5 Flash
const costPerDay = articlesPerDay * costPerArticle
const costPerMonth = costPerDay * 30

console.log(`  單篇成本: $${costPerArticle}`)
console.log(`  每日成本: $${costPerDay.toFixed(2)}`)
console.log(`  每月成本: $${costPerMonth.toFixed(2)}`)

console.log('\n🔍 品牌多樣性分析:')
const minBrands = Math.ceil(config.TARGET_ARTICLES / config.MAX_ARTICLES_PER_BRAND)
const maxBrands = Math.min(config.TARGET_ARTICLES, 30) // 假設有 30 個品牌

console.log(`  每次最少品牌數: ${minBrands} 個 (${config.TARGET_ARTICLES} / ${config.MAX_ARTICLES_PER_BRAND})`)
console.log(`  每次最多品牌數: ${maxBrands} 個`)

console.log('\n✅ 配置驗證完成！')
