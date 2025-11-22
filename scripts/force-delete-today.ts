import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function forceDeleteToday() {
  const today = new Date().toISOString().split('T')[0]

  console.log(`強制刪除今天 (${today}) 的所有文章...`)

  // 直接用 SQL RPC 刪除
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `DELETE FROM generated_articles WHERE created_at >= '${today}'`
  })

  if (error) {
    console.log('RPC 不存在，使用一般方法...')

    // 使用一般刪除方法
    const { error: deleteError, count } = await supabase
      .from('generated_articles')
      .delete()
      .gte('created_at', today)

    if (deleteError) {
      console.error('刪除失敗:', deleteError)

      // 試著一個一個刪除
      console.log('\n嘗試逐個刪除...')
      const { data: articles } = await supabase
        .from('generated_articles')
        .select('id')
        .gte('created_at', today)

      if (articles) {
        for (const article of articles) {
          const { error: singleError } = await supabase
            .from('generated_articles')
            .delete()
            .eq('id', article.id)

          if (singleError) {
            console.error(`刪除 ${article.id} 失敗:`, singleError.message)
          } else {
            console.log(`✅ 已刪除 ${article.id}`)
          }
        }
      }
    } else {
      console.log('✅ 批量刪除成功, count:', count)
    }
  } else {
    console.log('✅ SQL 刪除成功:', data)
  }

  // 清除 topic locks
  await supabase
    .from('daily_topic_locks')
    .delete()
    .eq('date', today)

  console.log('✅ Topic locks 已清除')

  // 驗證
  const { count: remaining } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)

  console.log(`\n剩餘今天的文章數: ${remaining}`)
}

forceDeleteToday()
