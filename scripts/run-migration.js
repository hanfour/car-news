/**
 * Script to execute SQL migration for get_popular_tags function
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Read SQL migration file
const migrationPath = join(__dirname, '../supabase/migrations/20250111_get_popular_tags_function.sql')
const sql = readFileSync(migrationPath, 'utf8')

console.log('Executing SQL migration...')
console.log('SQL:', sql)
console.log('\n---\n')

// Execute SQL
const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

if (error) {
  console.error('Migration failed:', error)

  // Try alternative method: execute directly via REST API
  console.log('\nTrying alternative method via REST API...')

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('Alternative method also failed:', result)
    console.error('\nPlease execute the SQL manually in Supabase Dashboard:')
    console.error('1. Go to https://supabase.com/dashboard/project/daubcanyykdfyptntfco/sql/new')
    console.error('2. Paste the SQL from: supabase/migrations/20250111_get_popular_tags_function.sql')
    console.error('3. Click "Run"')
    process.exit(1)
  }

  console.log('✅ Migration executed successfully via REST API!')
  console.log('Result:', result)
} else {
  console.log('✅ Migration executed successfully!')
  console.log('Result:', data)
}
