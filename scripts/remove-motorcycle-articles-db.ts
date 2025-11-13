/**
 * 直接從資料庫刪除機車相關文章
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// 載入環境變數
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 已知的機車文章 ID
const MOTORCYCLE_ARTICLE_IDS = [
  'pPNB8Ya',
  'LB5HhWj',
  'wyhqk9n',
  'JG4DTEV'
]

async function deleteArticles() {
  console.log(`🏍️  Removing ${MOTORCYCLE_ARTICLE_IDS.length} motorcycle articles...\n`)

  for (const id of MOTORCYCLE_ARTICLE_IDS) {
    // 先查詢文章標題
    const { data: article } = await supabase
      .from('generated_articles')
      .select('title_zh')
      .eq('id', id)
      .single()

    if (article) {
      console.log(`📄 Found: ${id} - ${article.title_zh}`)
    }
  }

  console.log('\n⚠️  Step 1: Deleting topic locks...')

  const { error: lockError, count: lockCount } = await supabase
    .from('daily_topic_locks')
    .delete({ count: 'exact' })
    .in('article_id', MOTORCYCLE_ARTICLE_IDS)

  if (lockError) {
    console.error('❌ Error deleting locks:', lockError)
    return
  }

  console.log(`✅ Deleted ${lockCount} topic locks`)

  console.log('\n⚠️  Step 2: Deleting articles...')

  const { error, count } = await supabase
    .from('generated_articles')
    .delete({ count: 'exact' })
    .in('id', MOTORCYCLE_ARTICLE_IDS)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`✅ Successfully deleted ${count} motorcycle articles\n`)
}

deleteArticles().catch(console.error)
