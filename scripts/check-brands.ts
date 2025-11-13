import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function checkBrands() {
  const supabase = createServiceClient()

  // Check Tesla brand page
  console.log('=== Checking Tesla Brand Page ===\n')

  const { data: teslaArticles, error: teslaError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, brands')
    .eq('published', true)
    .contains('brands', ['Tesla'])
    .order('published_at', { ascending: false })
    .limit(5)

  if (teslaError) {
    console.error('Tesla query error:', teslaError)
  } else {
    console.log(`Found ${teslaArticles?.length || 0} Tesla articles:`)
    teslaArticles?.forEach(article => {
      console.log(`- ${article.title_zh}`)
      console.log(`  ID: ${article.id}`)
      console.log(`  Brands: ${JSON.stringify(article.brands)}`)
      console.log()
    })
  }

  // Check for duplicates
  console.log('\n=== Checking for Duplicate Articles ===\n')

  const { data: allArticles, error: allError } = await supabase
    .from('generated_articles')
    .select('id, title_zh')
    .eq('published', true)
    .order('published_at', { ascending: false })

  if (allError) {
    console.error('All articles query error:', allError)
  } else {
    const titleMap = new Map<string, string[]>()

    allArticles?.forEach(article => {
      const ids = titleMap.get(article.title_zh) || []
      ids.push(article.id)
      titleMap.set(article.title_zh, ids)
    })

    const duplicates = Array.from(titleMap.entries()).filter(([_, ids]) => ids.length > 1)

    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate titles:`)
      duplicates.slice(0, 5).forEach(([title, ids]) => {
        console.log(`\n"${title}"`)
        console.log(`  IDs: ${ids.join(', ')}`)
      })
    } else {
      console.log('No duplicate titles found')
    }
  }

  // Check brand field structure
  console.log('\n=== Checking Brand Field Structure ===\n')

  const { data: sampleArticles, error: sampleError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, brands')
    .eq('published', true)
    .not('brands', 'is', null)
    .limit(10)

  if (sampleError) {
    console.error('Sample query error:', sampleError)
  } else {
    console.log('Sample brand fields:')
    sampleArticles?.forEach(article => {
      console.log(`\n- ${article.title_zh}`)
      console.log(`  Type: ${typeof article.brands}`)
      console.log(`  Value: ${JSON.stringify(article.brands)}`)
      console.log(`  Is Array: ${Array.isArray(article.brands)}`)
    })
  }
}

checkBrands()
  .then(() => {
    console.log('\n✅ Check complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
