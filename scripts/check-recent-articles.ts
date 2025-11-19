import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecentArticles() {
  // Get all recent articles from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)

  const { data: allArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, created_at, source_urls, published_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching articles:', error)
    return
  }

  console.log('\n=== 最近 7 天的文章 (共 ' + (allArticles?.length || 0) + ' 篇) ===')

  // Group by date
  const articlesByDate = new Map<string, typeof allArticles>()

  allArticles?.forEach(a => {
    const date = new Date(a.created_at).toLocaleDateString('zh-TW')
    if (!articlesByDate.has(date)) {
      articlesByDate.set(date, [])
    }
    articlesByDate.get(date)!.push(a)
  })

  // Display by date
  Array.from(articlesByDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([date, articles]) => {
      console.log(`\n${date} (${articles.length} 篇):`)
      articles.forEach(a => {
        console.log(`  ${new Date(a.created_at).toLocaleTimeString('zh-TW')} | ${a.title_zh.substring(0, 60)}`)
      })
    })

  // Now check for duplicates
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  today.setHours(0, 0, 0, 0)
  yesterday.setHours(0, 0, 0, 0)

  const todayArticles = allArticles?.filter(a => new Date(a.created_at) >= today) || []
  const yesterdayArticles = allArticles?.filter(a => {
    const date = new Date(a.created_at)
    return date >= yesterday && date < today
  }) || []

  console.log('\n=== 今天的文章 (' + todayArticles.length + ' 篇) ===')
  todayArticles.forEach(a => {
    console.log(`${new Date(a.created_at).toLocaleString('zh-TW')} | ${a.title_zh}`)
  })

  console.log('\n=== 昨天的文章 (' + yesterdayArticles.length + ' 篇) ===')
  yesterdayArticles.forEach(a => {
    console.log(`${new Date(a.created_at).toLocaleString('zh-TW')} | ${a.title_zh}`)
  })

  // Check for duplicates
  console.log('\n=== 檢查重複文章 ===')
  const todayTitles = new Set(todayArticles?.map(a => a.title_zh) || [])
  const yesterdayTitles = new Set(yesterdayArticles?.map(a => a.title_zh) || [])

  const duplicates = [...todayTitles].filter(title => yesterdayTitles.has(title))

  if (duplicates.length > 0) {
    console.log('⚠️  發現重複文章標題：')
    duplicates.forEach(title => console.log('  -', title))
  } else {
    console.log('✅ 沒有發現重複的文章標題')
  }

  // Check source URLs (flatten arrays)
  console.log('\n=== 檢查來源 URL ===')
  const todayUrls = new Set(todayArticles?.flatMap(a => a.source_urls || []) || [])
  const yesterdayUrls = new Set(yesterdayArticles?.flatMap(a => a.source_urls || []) || [])

  const duplicateUrls = [...todayUrls].filter(url => yesterdayUrls.has(url))

  if (duplicateUrls.length > 0) {
    console.log('⚠️  發現重複的來源 URL：')
    duplicateUrls.forEach(url => console.log('  -', url))
  } else {
    console.log('✅ 沒有發現重複的來源 URL')
  }
}

checkRecentArticles()
