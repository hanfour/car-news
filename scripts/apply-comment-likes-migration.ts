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

async function applyCommentLikesMigration() {
  console.log('Applying comment_likes migration...\n')

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251118_add_comment_likes.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('Migration SQL:')
  console.log('─'.repeat(60))
  console.log(migrationSQL)
  console.log('─'.repeat(60))
  console.log('\n⚠️  This script cannot execute DDL statements via API.')
  console.log('📋 Please copy the SQL above and execute it in:')
  console.log('   Supabase Dashboard > SQL Editor\n')
  console.log('Or run: npx supabase db push (if Supabase CLI is configured)\n')

  // Test if the migration was already applied
  console.log('🔍 Testing if migration is already applied...')

  const { data: tableCheck, error: tableError } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .limit(1)

  if (tableError) {
    if (tableError.message.includes('does not exist')) {
      console.log('❌ comment_likes table does not exist yet - migration needs to be applied')
    } else {
      console.log('❓ Unexpected error:', tableError.message)
    }
  } else {
    console.log('✅ comment_likes table exists!')

    // Check if likes_count column exists on comments
    const { data: commentCheck, error: commentError } = await supabase
      .from('comments')
      .select('id, likes_count')
      .limit(1)

    if (commentError) {
      if (commentError.message.includes('likes_count')) {
        console.log('❌ likes_count column missing on comments table')
      } else {
        console.log('❓ Unexpected error:', commentError.message)
      }
    } else {
      console.log('✅ likes_count column exists on comments table!')
      console.log('\n🎉 Migration appears to be fully applied!')
    }
  }
}

applyCommentLikesMigration()
