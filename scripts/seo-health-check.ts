#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

/**
 * SEO Health Check Script
 *
 * Validates:
 * 1. Sitemap.xml accessibility and format
 * 2. Robots.txt accessibility and content
 * 3. Article structured data (JSON-LD)
 * 4. Meta tags completeness
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'

interface HealthCheckResult {
  category: string
  status: 'pass' | 'warning' | 'fail'
  message: string
  details?: any
}

async function checkSitemap(): Promise<HealthCheckResult> {
  try {
    console.log('📄 Checking sitemap.xml...')
    const response = await fetch(`${BASE_URL}/sitemap.xml`)

    if (!response.ok) {
      return {
        category: 'Sitemap',
        status: 'fail',
        message: `HTTP ${response.status} - Sitemap not accessible`
      }
    }

    const content = await response.text()

    // Basic XML validation
    if (!content.includes('<?xml version="1.0"')) {
      return {
        category: 'Sitemap',
        status: 'fail',
        message: 'Invalid XML format'
      }
    }

    // Count URLs
    const urlMatches = content.match(/<loc>/g)
    const urlCount = urlMatches ? urlMatches.length : 0

    // Check for required elements
    const hasHomepage = content.includes(`<loc>${BASE_URL}</loc>`)
    const hasCategories = content.includes('/category/')
    const hasArticles = urlCount > 5 // Should have at least homepage + categories + some articles

    if (!hasHomepage || !hasCategories || !hasArticles) {
      return {
        category: 'Sitemap',
        status: 'warning',
        message: 'Sitemap is missing expected content',
        details: { hasHomepage, hasCategories, hasArticles, urlCount }
      }
    }

    return {
      category: 'Sitemap',
      status: 'pass',
      message: `✅ Sitemap valid with ${urlCount} URLs`,
      details: { urlCount }
    }
  } catch (error: any) {
    return {
      category: 'Sitemap',
      status: 'fail',
      message: `Error: ${error.message}`
    }
  }
}

async function checkRobotsTxt(): Promise<HealthCheckResult> {
  try {
    console.log('🤖 Checking robots.txt...')
    const response = await fetch(`${BASE_URL}/robots.txt`)

    if (!response.ok) {
      return {
        category: 'Robots.txt',
        status: 'fail',
        message: `HTTP ${response.status} - Robots.txt not accessible`
      }
    }

    const content = await response.text()

    // Check for required directives
    const hasUserAgent = content.includes('User-agent:')
    const hasSitemap = content.includes('Sitemap:')
    const hasDisallow = content.includes('Disallow:')
    const hasSitemapUrl = content.includes('/sitemap.xml')

    if (!hasUserAgent || !hasSitemap || !hasDisallow) {
      return {
        category: 'Robots.txt',
        status: 'warning',
        message: 'Robots.txt is missing expected directives',
        details: { hasUserAgent, hasSitemap, hasDisallow }
      }
    }

    if (!hasSitemapUrl) {
      return {
        category: 'Robots.txt',
        status: 'warning',
        message: 'Robots.txt does not reference sitemap.xml'
      }
    }

    return {
      category: 'Robots.txt',
      status: 'pass',
      message: '✅ Robots.txt valid with sitemap reference'
    }
  } catch (error: any) {
    return {
      category: 'Robots.txt',
      status: 'fail',
      message: `Error: ${error.message}`
    }
  }
}

async function checkStructuredData(articleUrl: string): Promise<HealthCheckResult> {
  try {
    console.log(`📋 Checking structured data for: ${articleUrl}`)
    const response = await fetch(articleUrl)

    if (!response.ok) {
      return {
        category: 'Structured Data',
        status: 'fail',
        message: `HTTP ${response.status} - Article not accessible`
      }
    }

    const html = await response.text()

    // Check for JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)

    if (!jsonLdMatch) {
      return {
        category: 'Structured Data',
        status: 'fail',
        message: 'No JSON-LD structured data found'
      }
    }

    try {
      const jsonLd = JSON.parse(jsonLdMatch[1])

      // Validate required fields
      const hasContext = jsonLd['@context'] === 'https://schema.org'
      const hasType = jsonLd['@type'] === 'NewsArticle'
      const hasHeadline = !!jsonLd.headline
      const hasDatePublished = !!jsonLd.datePublished
      const hasAuthor = !!jsonLd.author
      const hasPublisher = !!jsonLd.publisher

      if (!hasContext || !hasType) {
        return {
          category: 'Structured Data',
          status: 'fail',
          message: 'Invalid Schema.org format'
        }
      }

      if (!hasHeadline || !hasDatePublished || !hasAuthor || !hasPublisher) {
        return {
          category: 'Structured Data',
          status: 'warning',
          message: 'Structured data missing recommended fields',
          details: { hasHeadline, hasDatePublished, hasAuthor, hasPublisher }
        }
      }

      return {
        category: 'Structured Data',
        status: 'pass',
        message: '✅ Valid NewsArticle schema with all required fields'
      }
    } catch (parseError) {
      return {
        category: 'Structured Data',
        status: 'fail',
        message: 'Invalid JSON-LD format'
      }
    }
  } catch (error: any) {
    return {
      category: 'Structured Data',
      status: 'fail',
      message: `Error: ${error.message}`
    }
  }
}

async function checkMetaTags(articleUrl: string): Promise<HealthCheckResult> {
  try {
    console.log(`🏷️  Checking meta tags for: ${articleUrl}`)
    const response = await fetch(articleUrl)

    if (!response.ok) {
      return {
        category: 'Meta Tags',
        status: 'fail',
        message: `HTTP ${response.status} - Article not accessible`
      }
    }

    const html = await response.text()

    // Check for essential meta tags (order-agnostic patterns)
    const hasTitle = /<title>(.+?)<\/title>/.test(html)
    // Match meta tags regardless of attribute order
    const hasDescription = /<meta\s+[^>]*name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/.test(html) ||
                          /<meta\s+[^>]*content=["'][^"']+["'][^>]*name=["']description["'][^>]*>/.test(html)
    const hasOgTitle = /<meta\s+[^>]*property=["']og:title["'][^>]*content=["'][^"']+["'][^>]*>/.test(html) ||
                       /<meta\s+[^>]*content=["'][^"']+["'][^>]*property=["']og:title["'][^>]*>/.test(html)
    const hasOgDescription = /<meta\s+[^>]*property=["']og:description["'][^>]*content=["'][^"']+["'][^>]*>/.test(html) ||
                             /<meta\s+[^>]*content=["'][^"']+["'][^>]*property=["']og:description["'][^>]*>/.test(html)
    const hasOgImage = /<meta\s+[^>]*property=["']og:image["'][^>]*content=["'][^"']+["'][^>]*>/.test(html) ||
                       /<meta\s+[^>]*content=["'][^"']+["'][^>]*property=["']og:image["'][^>]*>/.test(html)
    const hasTwitterCard = /<meta\s+[^>]*name=["']twitter:card["'][^>]*content=["'][^"']+["'][^>]*>/.test(html) ||
                           /<meta\s+[^>]*content=["'][^"']+["'][^>]*name=["']twitter:card["'][^>]*>/.test(html)

    const missingTags = []
    if (!hasTitle) missingTags.push('title')
    if (!hasDescription) missingTags.push('description')
    if (!hasOgTitle) missingTags.push('og:title')
    if (!hasOgDescription) missingTags.push('og:description')
    if (!hasOgImage) missingTags.push('og:image')
    if (!hasTwitterCard) missingTags.push('twitter:card')

    if (missingTags.length > 0) {
      return {
        category: 'Meta Tags',
        status: 'warning',
        message: `Missing meta tags: ${missingTags.join(', ')}`,
        details: { missingTags }
      }
    }

    return {
      category: 'Meta Tags',
      status: 'pass',
      message: '✅ All essential meta tags present'
    }
  } catch (error: any) {
    return {
      category: 'Meta Tags',
      status: 'fail',
      message: `Error: ${error.message}`
    }
  }
}

async function getLatestArticleUrl(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/sitemap.xml`)
    if (!response.ok) return null

    const sitemap = await response.text()
    const locMatches = sitemap.match(/<loc>(.*?)<\/loc>/g)

    if (!locMatches) return null

    // Find first article URL (not homepage or category)
    for (const match of locMatches) {
      const url = match.replace(/<\/?loc>/g, '')
      if (url.match(/\/\d{4}\/\d{2}\//)) {
        return url
      }
    }

    return null
  } catch (error) {
    return null
  }
}

async function runHealthCheck() {
  console.log('🏥 SEO Health Check Starting...\n')
  console.log(`Base URL: ${BASE_URL}\n`)
  console.log('='.repeat(80))

  const results: HealthCheckResult[] = []

  // 1. Check sitemap
  results.push(await checkSitemap())

  // 2. Check robots.txt
  results.push(await checkRobotsTxt())

  // 3. Get a sample article for detailed checks
  console.log('\n' + '='.repeat(80))
  console.log('\n📰 Finding sample article for detailed checks...')

  const sampleArticleUrl = await getLatestArticleUrl()

  if (sampleArticleUrl) {
    console.log(`Sample: ${sampleArticleUrl}\n`)
    console.log('='.repeat(80) + '\n')

    // 4. Check structured data
    results.push(await checkStructuredData(sampleArticleUrl))

    // 5. Check meta tags
    results.push(await checkMetaTags(sampleArticleUrl))
  } else {
    console.log('⚠️  No articles found in sitemap\n')
    results.push({
      category: 'Articles',
      status: 'warning',
      message: 'No articles found in sitemap for detailed checks'
    })
  }

  // Print results
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 RESULTS\n')

  let passCount = 0
  let warningCount = 0
  let failCount = 0

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️ ' : '❌'
    console.log(`${icon} [${result.category}] ${result.message}`)

    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details)}`)
    }

    if (result.status === 'pass') passCount++
    else if (result.status === 'warning') warningCount++
    else failCount++
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📈 SUMMARY\n')
  console.log(`✅ Pass:    ${passCount}`)
  console.log(`⚠️  Warning: ${warningCount}`)
  console.log(`❌ Fail:    ${failCount}`)

  const overallStatus = failCount > 0 ? 'FAIL' : warningCount > 0 ? 'WARNING' : 'PASS'
  console.log(`\n🎯 Overall: ${overallStatus}`)

  if (failCount > 0) {
    console.log('\n🔧 Action Required: Fix failing checks before submitting to Google Search Console')
    process.exit(1)
  } else if (warningCount > 0) {
    console.log('\n💡 Recommendation: Address warnings to improve SEO performance')
  } else {
    console.log('\n🎉 All checks passed! Ready for Google Search Console submission.')
  }
}

runHealthCheck().catch(error => {
  console.error('❌ Health check failed:', error)
  process.exit(1)
})
