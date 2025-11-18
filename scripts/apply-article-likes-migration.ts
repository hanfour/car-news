import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { readFileSync } from 'fs'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function applyMigration() {
  console.log('Applying article_likes migration...')

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251118_add_article_likes.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  console.log('\n⚠️  Please manually execute this SQL in Supabase Dashboard > SQL Editor:')
  console.log('\n' + sql.trim() + '\n')
  console.log('\n✅ After running the SQL, test the article like and favorite features.')
}

applyMigration()
