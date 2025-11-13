import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function checkImageUrls() {
  const supabase = createServiceClient()

  console.log('🔍 Checking image URLs...\n')

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image')
    .eq('published', true)
    .not('cover_image', 'is', null)
    .limit(20)

  if (error) {
    console.error('Error:', error)
    return
  }

  let supabaseCount = 0
  let externalCount = 0
  const externalDomains = new Set<string>()

  articles?.forEach(article => {
    const url = article.cover_image as string

    if (url.includes('supabase.co')) {
      supabaseCount++
    } else {
      externalCount++
      try {
        const domain = new URL(url).hostname
        externalDomains.add(domain)
        console.log(`❌ External: ${domain}`)
        console.log(`   Title: ${article.title_zh}`)
        console.log(`   URL: ${url}`)
        console.log()
      } catch (e) {
        console.log(`⚠️  Invalid URL: ${url}`)
      }
    }
  })

  console.log('\n=== Summary ===')
  console.log(`✅ Supabase Storage: ${supabaseCount}`)
  console.log(`❌ External URLs: ${externalCount}`)
  console.log(`\n📋 External domains found:`)
  externalDomains.forEach(domain => console.log(`   - ${domain}`))
}

checkImageUrls()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
