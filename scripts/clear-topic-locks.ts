import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function clearLocks() {
  // 查看现有 locks
  const { data: locks, count } = await supabase
    .from('daily_topic_locks')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .limit(10)

  console.log('=== 現有 Topic Locks ===')
  console.log('總數:', count)
  locks?.forEach(l => {
    console.log(l.date, '|', l.topic_hash?.substring(0, 20) + '...')
  })

  // 刪除所有 locks
  const { error } = await supabase
    .from('daily_topic_locks')
    .delete()
    .gte('date', '2000-01-01') // 删除所有记录

  if (error) {
    console.error('❌ 清理失敗:', error.message)
    return
  }

  // 確認結果
  const { count: remaining } = await supabase
    .from('daily_topic_locks')
    .select('*', { count: 'exact', head: true })

  console.log('\n✅ 清理完成！')
  console.log('剩餘 locks:', remaining)
}

clearLocks()
