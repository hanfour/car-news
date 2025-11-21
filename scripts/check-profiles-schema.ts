import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('=== Checking profiles table schema ===\n')

  // Query table columns
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'profiles'
      ORDER BY ordinal_position;
    `
  })

  if (error) {
    console.log('RPC not available, trying direct query...')

    // Try selecting with all expected columns
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, created_at, updated_at, is_admin')
      .limit(1)

    if (testError) {
      console.error('❌ Error querying profiles:', testError)
      console.error('\nThis suggests the is_admin column might not exist.')
      console.log('\nYou need to run the migration in Supabase Dashboard:')
      console.log('1. Go to https://supabase.com/dashboard')
      console.log('2. Select your project')
      console.log('3. Go to SQL Editor')
      console.log('4. Run this SQL:')
      console.log('\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;')
    } else {
      console.log('✅ All columns accessible:', Object.keys(testData[0] || {}))
    }
  } else {
    console.log('Schema:', data)
  }
}

checkSchema()
