import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function verifyBrandFilter() {
  const supabase = createServiceClient()

  console.log('=== Verifying Tesla Brand Page ===\n')

  // Using the NEW query (primary_brand)
  const { data: teslaArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, brands, primary_brand')
    .eq('published', true)
    .eq('primary_brand', 'Tesla')
    .order('published_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${teslaArticles?.length || 0} articles with primary_brand = Tesla:\n`)

  teslaArticles?.forEach(article => {
    console.log(`✓ ${article.title_zh}`)
    console.log(`  Primary: ${article.primary_brand}`)
    console.log(`  Brands: [${(article.brands as string[]).join(', ')}]`)
    console.log()
  })

  // Check for MG articles that should NOT appear
  console.log('\n=== Checking MG Articles ===\n')

  const { data: mgArticles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, brands, primary_brand')
    .eq('published', true)
    .eq('primary_brand', 'MG')
    .limit(5)

  console.log(`Found ${mgArticles?.length || 0} articles with primary_brand = MG:\n`)

  mgArticles?.forEach(article => {
    console.log(`✓ ${article.title_zh}`)
    console.log(`  Primary: ${article.primary_brand}`)
    console.log(`  Brands: [${(article.brands as string[]).join(', ')}]`)
    console.log()
  })
}

verifyBrandFilter()
  .then(() => {
    console.log('✅ Verification complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
