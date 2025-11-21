/**
 * 修復已生成文章的 published_at 日期
 * 從 source_published_at (UTC) 轉換為台灣時區日期
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixPublishedDates() {
  console.log('\n🔧 修復文章發布日期...\n')

  // 獲取所有已發布的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, source_published_at, published')
    .eq('published', true)
    .not('source_published_at', 'is', null)

  if (error) {
    console.error('❌ 查詢失敗：', error)
    return
  }

  console.log(`找到 ${articles?.length || 0} 篇需要修復的文章\n`)

  let fixed = 0
  let skipped = 0

  for (const article of articles || []) {
    // 計算正確的台灣時區日期
    const utc = new Date(article.source_published_at!)
    const taiwan = new Date(utc.getTime() + 8 * 60 * 60 * 1000)
    const correctDate = taiwan.toISOString().split('T')[0]

    // 檢查是否需要更新
    if (article.published_at === correctDate) {
      skipped++
      continue
    }

    console.log(`📝 ${article.title_zh.substring(0, 50)}`)
    console.log(`   原始：${article.published_at} → 修正：${correctDate}`)

    // 更新日期
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({ published_at: correctDate })
      .eq('id', article.id)

    if (updateError) {
      console.log(`   ❌ 更新失敗：${updateError.message}`)
    } else {
      console.log(`   ✅ 已更新`)
      fixed++
    }
  }

  console.log(`\n✅ 完成！`)
  console.log(`   修復：${fixed} 篇`)
  console.log(`   跳過：${skipped} 篇（已正確）\n`)
}

fixPublishedDates()
