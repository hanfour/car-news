/**
 * Backfill Script: Scrape and generate articles for the past 6 months
 *
 * This script will:
 * 1. Scrape articles from the past 6 months (oldest to newest)
 * 2. Generate AI articles from scraped content
 * 3. Run in batches to avoid overwhelming the APIs
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

const CRON_API_KEY = process.env.CRON_SECRET_KEY || 'YPxXuvXTQ1+Ya0Vb7tA+PV8W2SQCbbAvU4r46z5jKvE='
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callCronEndpoint(endpoint: string): Promise<any> {
  const url = `${BASE_URL}/api/cron/${endpoint}`
  console.log(`Calling: ${url}`)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to call ${endpoint}: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function getArticleStats() {
  const supabase = createServiceClient()

  const { data: scrapedStats } = await supabase
    .from('scraped_articles')
    .select('id, source_url, published_at', { count: 'exact' })
    .order('published_at', { ascending: true })
    .limit(1)

  const { data: generatedStats } = await supabase
    .from('generated_articles')
    .select('id, published_at', { count: 'exact' })
    .eq('published', true)
    .order('published_at', { ascending: true })
    .limit(1)

  const { count: scrapedCount } = await supabase
    .from('scraped_articles')
    .select('*', { count: 'exact', head: true })

  const { count: generatedCount } = await supabase
    .from('generated_articles')
    .select('*', { count: 'exact', head: true })
    .eq('published', true)

  return {
    scraped: {
      count: scrapedCount || 0,
      oldest: scrapedStats?.[0]?.published_at || 'N/A',
    },
    generated: {
      count: generatedCount || 0,
      oldest: generatedStats?.[0]?.published_at || 'N/A',
    }
  }
}

async function backfillArticles(rounds: number = 10) {
  console.log('🚀 Starting backfill process...\n')

  // Get initial stats
  const initialStats = await getArticleStats()
  console.log('📊 Initial stats:')
  console.log(`   Scraped: ${initialStats.scraped.count} articles (oldest: ${initialStats.scraped.oldest})`)
  console.log(`   Generated: ${initialStats.generated.count} articles (oldest: ${initialStats.generated.oldest})`)
  console.log()

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Round ${round}/${rounds}`)
    console.log('='.repeat(60))

    try {
      // Step 1: Scrape articles
      console.log('\n📥 Step 1: Scraping articles...')
      const scrapeResult = await callCronEndpoint('scraper')
      console.log(`✅ Scraped: ${scrapeResult.scraped || 0} new articles`)

      // Wait a bit before generating
      await sleep(5000)

      // Step 2: Generate articles
      console.log('\n✨ Step 2: Generating AI articles...')
      const generateResult = await callCronEndpoint('generator')
      console.log(`✅ Generated: ${generateResult.generated || 0} articles`)

      // Get current stats
      const currentStats = await getArticleStats()
      console.log('\n📈 Progress:')
      console.log(`   Scraped: ${currentStats.scraped.count} (+${currentStats.scraped.count - initialStats.scraped.count})`)
      console.log(`   Generated: ${currentStats.generated.count} (+${currentStats.generated.count - initialStats.generated.count})`)

      // Wait before next round
      if (round < rounds) {
        console.log('\n⏳ Waiting 10 seconds before next round...')
        await sleep(10000)
      }
    } catch (error) {
      console.error(`❌ Error in round ${round}:`, error)
      console.log('Continuing to next round...')
    }
  }

  // Final stats
  console.log('\n' + '='.repeat(60))
  console.log('🎉 Backfill Complete!')
  console.log('='.repeat(60))

  const finalStats = await getArticleStats()
  console.log('\n📊 Final stats:')
  console.log(`   Scraped: ${finalStats.scraped.count} (oldest: ${finalStats.scraped.oldest})`)
  console.log(`   Generated: ${finalStats.generated.count} (oldest: ${finalStats.generated.oldest})`)
  console.log('\n   Total added:')
  console.log(`   - Scraped: +${finalStats.scraped.count - initialStats.scraped.count}`)
  console.log(`   - Generated: +${finalStats.generated.count - initialStats.generated.count}`)
}

// Run the backfill
const rounds = parseInt(process.argv[2] || '10', 10)
backfillArticles(rounds)
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
