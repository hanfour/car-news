import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function checkRawArticles() {
  console.log('=== 檢查 raw_articles 資料庫狀態 ===\n')

  // 1. 總數
  const { count: totalCount } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 總文章數: ${totalCount}`)

  // 2. 未過期的文章
  const now = new Date().toISOString()
  const { count: validCount } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', now)

  console.log(`✅ 未過期文章: ${validCount}`)

  // 3. 有 embedding 的文章
  const { count: withEmbeddingCount } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null)
    .gt('expires_at', now)

  console.log(`🧠 有 embedding 的文章: ${withEmbeddingCount}`)

  // 4. 沒有 embedding 的文章
  const { count: noEmbeddingCount } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null)
    .gt('expires_at', now)

  console.log(`⚠️  缺少 embedding 的文章: ${noEmbeddingCount}`)

  // 5. 最近爬取的文章
  const { data: recentArticles } = await supabase
    .from('raw_articles')
    .select('id, title, scraped_at, expires_at, embedding')
    .order('scraped_at', { ascending: false })
    .limit(5)

  console.log(`\n📰 最近爬取的 5 篇文章:`)
  recentArticles?.forEach((article, i) => {
    const hasEmbedding = article.embedding ? '✓' : '✗'
    const expired = new Date(article.expires_at) < new Date() ? '(已過期)' : ''
    console.log(`  ${i + 1}. [${hasEmbedding}] ${article.title.slice(0, 60)} ${expired}`)
    console.log(`     爬取時間: ${article.scraped_at}`)
  })

  // 6. 檢查 generator 的查詢條件
  console.log(`\n🔍 Generator 查詢條件檢查:`)
  const { data: generatorArticles, error } = await supabase
    .from('raw_articles')
    .select('id, title, embedding')
    .gt('expires_at', now)
    .not('embedding', 'is', null)
    .limit(10)

  if (error) {
    console.log(`   ❌ 查詢錯誤: ${error.message}`)
  } else {
    console.log(`   ✅ 符合 generator 條件的文章: ${generatorArticles?.length || 0}`)
    if (generatorArticles && generatorArticles.length > 0) {
      console.log(`   範例:`)
      generatorArticles.slice(0, 3).forEach((a, i) => {
        console.log(`     ${i + 1}. ${a.title.slice(0, 50)}...`)
      })
    }
  }

  // 7. 今日爬取的文章
  const today = new Date().toISOString().split('T')[0]
  const { count: todayCount } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', today)

  console.log(`\n📅 今日爬取: ${todayCount} 篇`)
}

checkRawArticles().catch(console.error)
