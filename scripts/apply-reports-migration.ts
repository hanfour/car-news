import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function applyMigration() {
  console.log('=== 執行 Reports & Ads Migration ===\n')

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251118_add_reports_and_ads.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration 檔案路徑:', migrationPath)
  console.log('📝 SQL 長度:', sql.length, 'bytes')
  console.log('\n執行中...\n')

  try {
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      console.error('❌ Migration 失敗:', error.message)
      console.error('\n錯誤詳情:', error)
      console.log('\n請手動在 Supabase Dashboard > SQL Editor 中執行以下 SQL:\n')
      console.log('=' . repeat(80))
      console.log(sql)
      console.log('='.repeat(80))
      process.exit(1)
    }

    console.log('✅ Migration 成功執行!')

    // Verify tables created
    console.log('\n驗證資料表...')

    const tables = ['article_reports', 'comment_reports', 'ad_placements']

    for (const table of tables) {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.log(`  ❌ ${table}: 不存在或無法訪問`)
      } else {
        console.log(`  ✅ ${table}: 已建立 (目前有 ${count} 筆資料)`)
      }
    }

  } catch (err: any) {
    console.error('❌ 執行失敗:', err.message)
    console.log('\n由於 Supabase 不支援 rpc("exec_sql")，請手動執行 Migration:')
    console.log('\n步驟:')
    console.log('1. 打開 Supabase Dashboard: https://supabase.com/dashboard/project/_')
    console.log('2. 進入 SQL Editor')
    console.log('3. 複製以下 SQL 並執行:\n')
    console.log('='.repeat(80))
    console.log(sql)
    console.log('='.repeat(80))
  }
}

applyMigration().catch(console.error)
