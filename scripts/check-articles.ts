import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function check() {
  // 最近文章
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, created_at, published')
    .order('created_at', { ascending: false })
    .limit(15)

  console.log('=== 最近 15 篇文章 ===')
  articles?.forEach(a => {
    console.log(a.created_at.substring(0, 16), '|', a.published ? '✅' : '❌', '|', a.title_zh?.substring(0, 45))
  })

  // 今天
  const today = new Date().toISOString().split('T')[0]
  const { count: todayCount } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)

  console.log('\n=== 今天 (' + today + ') 文章數:', todayCount)

  // 昨天
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const { count: yesterdayCount } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday)
    .lt('created_at', today)

  console.log('=== 昨天 (' + yesterday + ') 文章數:', yesterdayCount)

  // 待處理新聞 (raw_articles 表)
  const { count: pendingNews } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false)

  console.log('=== 待處理原始新聞數:', pendingNews)

  // 最近爬取的新聞
  const { data: recentNews } = await supabase
    .from('raw_articles')
    .select('title, scraped_at, processed')
    .order('scraped_at', { ascending: false })
    .limit(5)

  console.log('\n=== 最近 5 則爬取的新聞 (raw_articles) ===')
  recentNews?.forEach(n => {
    console.log(n.scraped_at?.substring(0, 16) || 'N/A', '|', n.processed ? '✅' : '⏳', '|', n.title?.substring(0, 40))
  })

  // 總新聞數
  const { count: totalNews } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })

  console.log('\n=== 總原始新聞數:', totalNews)

  // 未過期新聞數（generator 使用這個條件）
  const { count: notExpired } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString())

  console.log('=== 未過期原始新聞數:', notExpired)

  // 最近爬取時間
  const { data: latestScrape } = await supabase
    .from('raw_articles')
    .select('scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single()

  console.log('=== 最後一次爬取時間:', latestScrape?.scraped_at || 'N/A')

  // 檢查 daily_topic_locks
  const { count: lockCount } = await supabase
    .from('daily_topic_locks')
    .select('*', { count: 'exact', head: true })

  console.log('\n=== daily_topic_locks 總數:', lockCount)

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const { count: recentLocks } = await supabase
    .from('daily_topic_locks')
    .select('*', { count: 'exact', head: true })
    .gte('date', threeDaysAgo.toISOString().split('T')[0])

  console.log('=== 最近 3 天的 topic locks:', recentLocks)
}

check()
