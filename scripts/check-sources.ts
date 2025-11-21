import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSources() {
  // Check generated_articles table
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('=== 最近 24 小時的 Generated Articles ===')
  console.log('總數:', articles.length)
  console.log('')

  if (articles.length === 0) {
    console.log('⚠️ 最近 24 小時沒有任何 generated_articles!')
    console.log('   這意味著 Scraper 沒有在運作,或者沒有新的新聞來源。')
    return
  }

  const published = articles.filter((a) => a.published_to_articles).length
  const unpublished = articles.filter((a) => !a.published_to_articles).length

  console.log('已發布到 articles:', published)
  console.log('未發布:', unpublished)
  console.log('')

  console.log('=== 最近生成的文章 (前 5 筆) ===')
  articles.slice(0, 5).forEach((a) => {
    const status = a.published_to_articles ? '✅ 已發布' : '❌ 未發布'
    console.log(status, a.created_at.substring(0, 19))
    console.log('   來源:', a.source_url?.substring(0, 100) || 'N/A')
  })
}

checkSources()
