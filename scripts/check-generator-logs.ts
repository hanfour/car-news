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

async function checkGeneratorLogs() {
  console.log('=== 檢查 Generator 執行日誌 ===\n')

  // 檢查最近的 cron_logs
  const { data: logs, error } = await supabase
    .from('cron_logs')
    .select('*')
    .eq('job_name', 'generator')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching logs:', error)
    return
  }

  if (!logs || logs.length === 0) {
    console.log('❌ 沒有找到 generator 日誌')
    return
  }

  console.log(`📝 最近 ${logs.length} 次 generator 執行:\n`)

  logs.forEach((log, i) => {
    console.log(`${i + 1}. [${log.status}] ${log.created_at}`)
    if (log.metadata) {
      console.log(`   Metadata:`, JSON.stringify(log.metadata, null, 2))
    }
    console.log()
  })

  // 檢查是否有已生成的文章
  const { count: generatedCount } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📰 已生成文章總數: ${generatedCount}`)

  // 檢查今日生成
  const today = new Date().toISOString().split('T')[0]
  const { count: todayCount } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)

  console.log(`📅 今日生成: ${todayCount} 篇`)
}

checkGeneratorLogs().catch(console.error)
