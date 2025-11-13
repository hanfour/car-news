import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function checkSimilarArticles() {
  const supabase = createServiceClient()

  const ids = ['Ro1cAFE', 'SAVRYZZ', '7ccp2En']

  console.log('🔍 Checking articles...\n')

  for (const id of ids) {
    const { data: article, error } = await supabase
      .from('generated_articles')
      .select('id, title_zh, content_zh, published_at, created_at, source_urls')
      .eq('id', id)
      .single()

    if (error) {
      console.error(`Error fetching ${id}:`, error)
      continue
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`ID: ${article.id}`)
    console.log(`Title: ${article.title_zh}`)
    console.log(`Published: ${article.published_at}`)
    console.log(`Created: ${article.created_at}`)
    console.log(`Source URLs: ${(article.source_urls as string[]).length} URLs`)
    console.log(`\nContent preview:`)
    console.log((article.content_zh as string).substring(0, 300) + '...')
  }

  console.log(`\n${'='.repeat(80)}`)
}

checkSimilarArticles()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
