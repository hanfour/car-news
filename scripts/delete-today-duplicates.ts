import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function deleteTodayDuplicates() {
  const today = new Date().toISOString().split('T')[0]

  // 找出今天生成的文章
  const { data: todayArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, created_at')
    .gte('created_at', today)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching articles:', error)
    return
  }

  console.log(`=== 今天 (${today}) 的文章 ===`)
  todayArticles?.forEach(a => {
    console.log(a.id, '|', a.title_zh?.substring(0, 50))
  })

  if (!todayArticles || todayArticles.length === 0) {
    console.log('今天沒有文章')
    return
  }

  const ids = todayArticles.map(a => a.id)
  console.log(`\n準備刪除 ${ids.length} 篇文章...`)

  // 先刪除關聯的圖片
  for (const id of ids) {
    const { error: imgError } = await supabase
      .from('article_images')
      .delete()
      .eq('article_id', id)

    if (imgError) {
      console.log(`⚠ 刪除圖片失敗 (${id}):`, imgError.message)
    }
  }

  // 再刪除文章
  const { error: deleteError } = await supabase
    .from('generated_articles')
    .delete()
    .in('id', ids)

  if (deleteError) {
    console.error('❌ 刪除文章失敗:', deleteError.message)
    return
  }

  console.log('✅ 刪除成功!')

  // 同時清除今天新建的 topic locks
  const { error: lockError } = await supabase
    .from('daily_topic_locks')
    .delete()
    .eq('date', today)

  if (lockError) {
    console.error('⚠ 清除 topic locks 失敗:', lockError.message)
  } else {
    console.log('✅ 今天的 topic locks 也已清除')
  }
}

deleteTodayDuplicates()
