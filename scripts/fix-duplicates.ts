import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function removeDuplicates() {
  const supabase = createServiceClient()

  console.log('🔍 Finding duplicate articles...\n')

  // Get all published articles
  const { data: allArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, created_at')
    .eq('published', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching articles:', error)
    return
  }

  // Find duplicates by title
  const titleMap = new Map<string, Array<{ id: string, published_at: string | null, created_at: string }>>()

  allArticles?.forEach(article => {
    const articles = titleMap.get(article.title_zh) || []
    articles.push({
      id: article.id,
      published_at: article.published_at,
      created_at: article.created_at
    })
    titleMap.set(article.title_zh, articles)
  })

  const duplicates = Array.from(titleMap.entries()).filter(([_, articles]) => articles.length > 1)

  console.log(`Found ${duplicates.length} duplicate titles\n`)

  if (duplicates.length === 0) {
    console.log('✅ No duplicates to remove')
    return
  }

  // For each duplicate, keep the oldest one (first created), unpublish the rest
  let removed = 0

  for (const [title, articles] of duplicates) {
    // Sort by created_at, keep the first one
    const sorted = articles.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const toKeep = sorted[0]
    const toRemove = sorted.slice(1)

    console.log(`\n"${title}"`)
    console.log(`  Keeping: ${toKeep.id} (created: ${toKeep.created_at})`)
    console.log(`  Removing: ${toRemove.map(a => a.id).join(', ')}`)

    // Unpublish duplicates
    for (const article of toRemove) {
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({ published: false })
        .eq('id', article.id)

      if (updateError) {
        console.error(`  ❌ Failed to unpublish ${article.id}:`, updateError)
      } else {
        console.log(`  ✅ Unpublished ${article.id}`)
        removed++
      }
    }
  }

  console.log(`\n✨ Removed ${removed} duplicate articles`)
}

removeDuplicates()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
