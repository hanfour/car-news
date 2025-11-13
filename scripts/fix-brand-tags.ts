import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function fixBrandTags() {
  const supabase = createServiceClient()

  console.log('🔍 Finding articles with too many brands...\n')

  // Get all published articles with brands
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, brands, primary_brand')
    .eq('published', true)
    .not('brands', 'is', null)

  if (error) {
    console.error('Error fetching articles:', error)
    return
  }

  let fixed = 0

  for (const article of articles || []) {
    const brands = article.brands as string[]

    if (!brands || brands.length <= 3) {
      continue // Skip articles with 3 or fewer brands
    }

    // Limit to 3 brands, prioritizing primary_brand
    let filteredBrands: string[] = []

    if (article.primary_brand) {
      // Ensure primary_brand is first
      filteredBrands.push(article.primary_brand)
      // Add up to 2 more brands (excluding primary_brand)
      const otherBrands = brands.filter(b => b !== article.primary_brand).slice(0, 2)
      filteredBrands.push(...otherBrands)
    } else {
      // No primary_brand, just take first 3
      filteredBrands = brands.slice(0, 3)
    }

    console.log(`"${article.title_zh}"`)
    console.log(`  Before: [${brands.join(', ')}] (${brands.length} brands)`)
    console.log(`  After:  [${filteredBrands.join(', ')}] (${filteredBrands.length} brands)`)

    // Update the article
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({ brands: filteredBrands })
      .eq('id', article.id)

    if (updateError) {
      console.error(`  ❌ Failed to update ${article.id}:`, updateError)
    } else {
      console.log(`  ✅ Updated`)
      fixed++
    }

    console.log()
  }

  console.log(`✨ Fixed ${fixed} articles`)
}

fixBrandTags()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
