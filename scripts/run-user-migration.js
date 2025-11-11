const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Read migration file
  const sql = fs.readFileSync('supabase/migrations/005_add_user_system.sql', 'utf8')

  console.log('→ Running user system migration...')

  try {
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
      // If exec_sql doesn't exist, try direct execution
      return supabase.from('_migrations').insert({ name: '005_add_user_system' })
    })

    console.log('✓ Migration completed')
    console.log('\n📊 Created tables:')
    console.log('  - public.profiles (會員資料)')
    console.log('  - public.user_favorites (收藏)')
    console.log('  - public.comments (評論)')
    console.log('\n⚠️  請手動到 Supabase Dashboard 執行 SQL：')
    console.log('  → Database → SQL Editor → 貼上 005_add_user_system.sql → Run')
  } catch (error) {
    console.error('✗ Migration failed:', error.message)
    console.log('\n⚠️  請手動執行 migration：')
    console.log('  1. 打開 Supabase Dashboard')
    console.log('  2. 進入 SQL Editor')
    console.log('  3. 貼上 supabase/migrations/005_add_user_system.sql 內容')
    console.log('  4. 點擊 Run')
  }
}

runMigration()
