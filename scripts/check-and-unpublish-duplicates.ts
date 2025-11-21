/**
 * 檢查並下架重複的相似文章
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const DUPLICATE_IDS = ['YcyFVum', 'eHuulRW', 'YAmIDBq', 'xcDFuJz']

async function checkAndUnpublish() {
  console.log('\n=== 檢查重複文章 ===\n')

  // 檢查這些文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, published, created_at')
    .in('id', DUPLICATE_IDS)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ 查詢失敗：', error)
    return
  }

  if (!articles || articles.length === 0) {
    console.log('✅ 資料庫中找不到這些文章 ID')
    console.log('   這表示本地資料庫已經重置，但 Vercel 仍在使用舊數據')
    console.log('\n建議：')
    console.log('   1. 確認 Vercel 使用的數據庫是否正確')
    console.log('   2. 如果 Vercel 使用獨立數據庫，需要對 production 環境執行相同的重置操作')
    return
  }

  console.log(`找到 ${articles.length} 篇相關文章：\n`)

  // 分組顯示
  const groups = [
    { name: 'Robotaxi 安全駕駛睡著', ids: ['YcyFVum', 'eHuulRW'] },
    { name: 'Tesla 測試 Apple CarPlay', ids: ['YAmIDBq', 'xcDFuJz'] }
  ]

  for (const group of groups) {
    console.log(`\n📁 主題：${group.name}`)

    const groupArticles = articles.filter(a => group.ids.includes(a.id))
    groupArticles.forEach((article, index) => {
      console.log(`\n   ${index + 1}. ID: ${article.id}`)
      console.log(`      標題: ${article.title_zh}`)
      console.log(`      發布日期: ${article.published_at}`)
      console.log(`      創建時間: ${article.created_at}`)
      console.log(`      狀態: ${article.published ? '✅ 已發布' : '❌ 未發布'}`)
    })

    if (groupArticles.length >= 2) {
      // 保留較早的文章，下架較晚的
      const toKeep = groupArticles[0]
      const toUnpublish = groupArticles.slice(1)

      console.log(`\n   建議操作：`)
      console.log(`   ✅ 保留：[${toKeep.id}] ${toKeep.title_zh}`)

      for (const article of toUnpublish) {
        if (article.published) {
          console.log(`   ❌ 下架：[${article.id}] ${article.title_zh}`)

          const { error: updateError } = await supabase
            .from('generated_articles')
            .update({ published: false })
            .eq('id', article.id)

          if (updateError) {
            console.log(`      ⚠️  下架失敗：${updateError.message}`)
          } else {
            console.log(`      ✅ 已下架`)
          }
        } else {
          console.log(`   ⏭️  跳過：[${article.id}] ${article.title_zh}（已下架）`)
        }
      }
    }
  }

  console.log('\n\n✅ 完成！\n')
}

checkAndUnpublish()
