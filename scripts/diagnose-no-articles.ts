#!/usr/bin/env tsx
/**
 * 診斷為什麼沒有新文章生成
 */

import 'dotenv/config'
import { createClient } from '@/lib/supabase'

async function diagnose() {
  const supabase = createClient()

  console.log('🔍 診斷：為什麼沒有新文章？\n')
  console.log('=' .repeat(80))

  // 1. 檢查最近 7 天的文章
  console.log('\n📅 最近 7 天的文章統計:\n')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: recentArticles, error } = await supabase
    .from('generated_articles')
    .select('id, published_at, published, primary_brand')
    .gte('published_at', sevenDaysAgo.toISOString())
    .order('published_at', { ascending: false })

  if (error) {
    console.error('❌ 查詢錯誤:', error)
    return
  }

  // 按日期分組
  const articlesByDate: Record<string, number> = {}
  const publishedByDate: Record<string, number> = {}

  recentArticles.forEach(article => {
    const date = article.published_at.split('T')[0]
    articlesByDate[date] = (articlesByDate[date] || 0) + 1
    if (article.published) {
      publishedByDate[date] = (publishedByDate[date] || 0) + 1
    }
  })

  // 顯示過去 7 天
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const total = articlesByDate[dateStr] || 0
    const published = publishedByDate[dateStr] || 0

    const dayName = i === 0 ? '今天' : i === 1 ? '昨天' : `${i} 天前`
    const status = total === 0 ? '❌' : total > 0 ? '✅' : '⚠️'

    console.log(`${status} ${dateStr} (${dayName}): ${total} 篇總計, ${published} 篇已發布`)
  }

  console.log('\n' + '='.repeat(80))

  // 2. 檢查最近的源文章（scraper）
  console.log('\n📰 檢查 Scraper 是否正常:\n')

  const { data: sources, error: sourcesError } = await supabase
    .from('scraped_articles')
    .select('id, published_at, source')
    .gte('published_at', sevenDaysAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(10)

  if (sourcesError) {
    console.error('❌ 查詢錯誤:', sourcesError)
  } else {
    console.log(`✅ 最近 7 天抓取了 ${sources.length} 篇源文章`)
    if (sources.length > 0) {
      console.log(`   最新: ${sources[0].published_at} - ${sources[0].source}`)
    } else {
      console.log('   ⚠️  沒有新的源文章！Scraper 可能停止運行')
    }
  }

  console.log('\n' + '='.repeat(80))

  // 3. 可能的原因分析
  console.log('\n💡 可能的原因分析:\n')

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const dayBefore = new Date(Date.now() - 172800000).toISOString().split('T')[0]

  const todayCount = articlesByDate[today] || 0
  const yesterdayCount = articlesByDate[yesterday] || 0
  const dayBeforeCount = articlesByDate[dayBefore] || 0

  if (todayCount === 0 && yesterdayCount === 0 && dayBeforeCount === 0) {
    console.log('❌ 問題 1: Generator Cron 可能沒有執行')
    console.log('   原因: Vercel Cron 配置問題或 Cron secret 錯誤')
    console.log('   解決: 檢查 Vercel Dashboard → Settings → Cron')
    console.log('')

    console.log('❌ 問題 2: Generator 執行但全部超時失敗')
    console.log('   原因: 之前的配置（60 篇/次）超過 5 分鐘限制')
    console.log('   解決: 新配置（10 篇/次）已部署，應該修復此問題')
    console.log('')

    if (sources.length === 0) {
      console.log('❌ 問題 3: Scraper 也停止運行')
      console.log('   原因: 沒有源文章，Generator 無法生成')
      console.log('   解決: 檢查 Scraper Cron 是否正常')
    }
  } else if (todayCount > 0 && publishedByDate[today] === 0) {
    console.log('⚠️  問題: 文章有生成但沒有發布')
    console.log('   原因: 文章卡在草稿狀態')
    console.log('   解決: 檢查發布邏輯或手動發布')
  }

  console.log('\n' + '='.repeat(80))

  // 4. 立即行動建議
  console.log('\n🚀 立即行動建議:\n')

  console.log('1️⃣  檢查 Vercel 部署狀態')
  console.log('   訪問: https://vercel.com/[your-team]/car-news-ai/deployments')
  console.log('   確認: 最新部署已成功完成')
  console.log('')

  console.log('2️⃣  檢查 Vercel Cron 配置')
  console.log('   訪問: https://vercel.com/[your-team]/car-news-ai/settings/cron')
  console.log('   確認: Generator schedule 為 "0 * * * *" (每小時)')
  console.log('')

  console.log('3️⃣  手動觸發一次測試')
  console.log('   訪問: https://wantcar.autos/admin')
  console.log('   點擊: 「觸發 Generator」按鈕')
  console.log('   預期: 4-5 分鐘後生成 10 篇新文章')
  console.log('')

  console.log('4️⃣  查看 Vercel 日誌')
  console.log('   命令: vercel logs --since 24h | grep "Generator"')
  console.log('   查找: 執行記錄和錯誤訊息')
  console.log('')

  console.log('=' .repeat(80))
}

diagnose()
