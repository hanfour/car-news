import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function checkTopicLocks() {
  const supabase = createServiceClient()

  const ids = ['Ro1cAFE', 'SAVRYZZ', '7ccp2En']
  const today = '2025-11-12'

  console.log('🔍 Checking topic locks...\n')

  for (const id of ids) {
    const { data: lock, error } = await supabase
      .from('daily_topic_locks')
      .select('*')
      .eq('date', today)
      .eq('article_id', id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching lock for ${id}:`, error)
      continue
    }

    console.log(`Article: ${id}`)
    if (lock) {
      console.log(`  ✅ Has topic lock: ${lock.topic_hash}`)
    } else {
      console.log(`  ❌ NO topic lock found!`)
    }
  }

  // Check all locks for today
  console.log(`\n\n=== All topic locks for ${today} ===\n`)

  const { data: allLocks, error: allError } = await supabase
    .from('daily_topic_locks')
    .select('*')
    .eq('date', today)

  if (allError) {
    console.error('Error:', allError)
    return
  }

  console.log(`Total locks: ${allLocks?.length || 0}`)

  // Check if these 3 articles have the same topic_hash
  const locks = allLocks?.filter(l => ids.includes(l.article_id))
  if (locks && locks.length > 0) {
    console.log('\nLocks for our 3 articles:')
    locks.forEach(lock => {
      console.log(`  - ${lock.article_id}: ${lock.topic_hash}`)
    })

    // Check for duplicates
    const hashes = locks.map(l => l.topic_hash)
    const uniqueHashes = new Set(hashes)
    if (uniqueHashes.size < hashes.length) {
      console.log('\n⚠️  DUPLICATE topic_hash detected!')
    } else {
      console.log('\n✅ All topic_hash values are unique')
    }
  }
}

checkTopicLocks()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
