import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function removeSimilarArticles() {
  const supabase = createServiceClient()

  // 保留 Ro1cAFE (第一篇),移除另外兩篇
  const toRemove = ['SAVRYZZ', '7ccp2En']

  console.log('🗑️  Removing similar articles...\n')

  for (const id of toRemove) {
    const { data: article } = await supabase
      .from('generated_articles')
      .select('title_zh')
      .eq('id', id)
      .single()

    console.log(`Unpublishing: ${id}`)
    console.log(`  Title: ${article?.title_zh}`)

    const { error } = await supabase
      .from('generated_articles')
      .update({ published: false })
      .eq('id', id)

    if (error) {
      console.error(`  ❌ Failed:`, error)
    } else {
      console.log(`  ✅ Unpublished`)
    }
  }

  console.log('\n✨ Done')
}

removeSimilarArticles()
  .then(() => {
    console.log('\n✅ Cleanup complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
