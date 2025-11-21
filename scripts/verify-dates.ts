import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyDates() {
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, source_published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('\n=== 檢查文章日期 ===\n')

  articles?.forEach(article => {
    console.log(`📄 ${article.title_zh.substring(0, 50)}`)
    console.log(`   published_at (台灣時區): ${article.published_at}`)
    console.log(`   source_published_at (UTC): ${article.source_published_at}`)
    console.log(`   created_at: ${article.created_at}`)

    // 驗證時區轉換
    if (article.source_published_at) {
      const utc = new Date(article.source_published_at)
      const taiwan = new Date(utc.getTime() + 8 * 60 * 60 * 1000)
      const expectedDate = taiwan.toISOString().split('T')[0]

      if (article.published_at === expectedDate) {
        console.log(`   ✅ 時區轉換正確`)
      } else {
        console.log(`   ❌ 時區轉換錯誤！預期 ${expectedDate}，實際 ${article.published_at}`)
      }
    }
    console.log('')
  })
}

verifyDates()
