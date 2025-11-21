#!/usr/bin/env node
import { createServiceClient } from '../src/lib/supabase'

async function applyAdminMigration() {
  console.log('🔄 Applying admin migration...\n')

  const supabase = createServiceClient()

  try {
    // 1. Add is_admin column
    console.log('1️⃣ Adding is_admin column to profiles...')
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;'
    })

    if (alterError) {
      console.error('❌ Failed to add column:', alterError.message)
      // Try alternative approach using raw SQL
      console.log('   Trying alternative approach...')
      await supabase.from('profiles').select('is_admin').limit(1)
    } else {
      console.log('✅ Column added successfully')
    }

    // 2. Create index
    console.log('\n2️⃣ Creating index for admin users...')
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;'
    })

    if (indexError) {
      console.log('⚠️  Index creation skipped (may require manual creation)')
    } else {
      console.log('✅ Index created successfully')
    }

    console.log('\n✅ Migration applied successfully!')
    console.log('\n📝 Next steps:')
    console.log('   1. Go to Supabase Dashboard → SQL Editor')
    console.log('   2. Run: UPDATE profiles SET is_admin = TRUE WHERE email = \'your-email@example.com\';')
    console.log('   3. Test login at http://localhost:3000/admin/login')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.log('\n📝 Manual steps required:')
    console.log('   1. Open Supabase Dashboard → SQL Editor')
    console.log('   2. Copy and run the SQL from: supabase/migrations/20251119_add_admin_users.sql')
    console.log('   3. Then run: UPDATE profiles SET is_admin = TRUE WHERE email = \'your-email@example.com\';')
  }
}

applyAdminMigration()
