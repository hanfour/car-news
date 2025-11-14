/**
 * 刪除與汽車主題不相關的文章
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 用戶指定的不相關文章 ID
const IRRELEVANT_IDS = [
  '37ADKwv',
  'YNTDupu',
  'eU3zdyO',
  'WFwgdTF',
  // 剛生成的也不相關
  'kPg6lp9',  // 電動機車
  'Pl5Of1O',  // 美國政府停擺/FAA
  'NLCdqmc',  // 駕照考試
]

async function main() {
  console.log(`🗑️  Removing ${IRRELEVANT_IDS.length} irrelevant articles...\n`)

  // 查詢文章標題
  for (const id of IRRELEVANT_IDS) {
    const { data: article } = await supabase
      .from('generated_articles')
      .select('title_zh')
      .eq('id', id)
      .single()

    if (article) {
      console.log(`📄 Found: ${id} - ${article.title_zh}`)
    } else {
      console.log(`⚠️  Not found: ${id}`)
    }
  }

  console.log('\n⚠️  Step 1: Deleting topic locks...')

  const { error: lockError, count: lockCount } = await supabase
    .from('daily_topic_locks')
    .delete({ count: 'exact' })
    .in('article_id', IRRELEVANT_IDS)

  if (lockError) {
    console.error('❌ Error deleting locks:', lockError)
    return
  }

  console.log(`✅ Deleted ${lockCount || 0} topic locks`)

  console.log('\n⚠️  Step 2: Deleting articles...')

  const { error, count } = await supabase
    .from('generated_articles')
    .delete({ count: 'exact' })
    .in('id', IRRELEVANT_IDS)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`✅ Successfully deleted ${count} irrelevant articles\n`)
}

main().catch(console.error)
