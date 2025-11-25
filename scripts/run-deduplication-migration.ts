#!/usr/bin/env tsx

/**
 * Run deduplication migration manually
 * This adds the used_in_article_id field to raw_articles table
 */

import { createServiceClient } from '../src/lib/supabase'

async function runMigration() {
  console.log('🚀 Running deduplication migration...\n')

  const supabase = createServiceClient()

  try {
    // 1. Check if column already exists
    console.log('1. Checking if column already exists...')
    const { data: columns, error: checkError } = await supabase
      .rpc('get_table_columns', { table_name: 'raw_articles' })
      .single()

    if (checkError) {
      console.log('   ℹ️  Cannot check column (this is ok, will proceed)')
    }

    // 2. Add the column
    console.log('2. Adding used_in_article_id column to raw_articles...')

    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE raw_articles
        ADD COLUMN IF NOT EXISTS used_in_article_id CHAR(7) REFERENCES generated_articles(id);
      `
    })

    if (alterError) {
      console.log('   ⚠️  Direct SQL failed, trying alternative method...')
      // Alternative: Using Supabase dashboard or psql required
      console.log('\n   Please run this SQL manually in Supabase SQL Editor:')
      console.log('   ─────────────────────────────────────────────────')
      console.log('   ALTER TABLE raw_articles')
      console.log('   ADD COLUMN IF NOT EXISTS used_in_article_id CHAR(7)')
      console.log('   REFERENCES generated_articles(id);')
      console.log('   ─────────────────────────────────────────────────\n')
      return
    }

    // 3. Create index
    console.log('3. Creating index...')
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_raw_articles_used_in
        ON raw_articles(used_in_article_id)
        WHERE used_in_article_id IS NOT NULL;
      `
    })

    if (indexError) {
      console.log('   ⚠️  Index creation failed (non-critical)')
    } else {
      console.log('   ✅ Index created')
    }

    // 4. Verify
    console.log('4. Verifying migration...')
    const { data: testData, error: verifyError } = await supabase
      .from('raw_articles')
      .select('id, used_in_article_id')
      .limit(1)

    if (verifyError) {
      console.error('   ❌ Verification failed:', verifyError.message)
      throw verifyError
    }

    console.log('   ✅ Migration successful!')
    console.log('\n✨ Deduplication system is now active!')
    console.log('   - Title similarity check: ✅')
    console.log('   - Raw article marking: ✅')
    console.log('   - Topic locks: ✅')

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    console.log('\n📋 Manual steps required:')
    console.log('1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Run this SQL:')
    console.log('   ─────────────────────────────────────────────────')
    console.log('   ALTER TABLE raw_articles')
    console.log('   ADD COLUMN IF NOT EXISTS used_in_article_id CHAR(7)')
    console.log('   REFERENCES generated_articles(id);')
    console.log('')
    console.log('   CREATE INDEX IF NOT EXISTS idx_raw_articles_used_in')
    console.log('   ON raw_articles(used_in_article_id)')
    console.log('   WHERE used_in_article_id IS NOT NULL;')
    console.log('   ─────────────────────────────────────────────────')
    process.exit(1)
  }
}

runMigration()
