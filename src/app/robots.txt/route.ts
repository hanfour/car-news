import { NextResponse } from 'next/server'

/**
 * Dynamic robots.txt generation
 *
 * Controls which pages search engines can crawl and index
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'

  const robotsTxt = `# Robots.txt for WANT CAR (玩咖)
# Generated: ${new Date().toISOString()}

# Allow all search engines to crawl public content
User-agent: *
Allow: /
Allow: /*.webp$
Allow: /*.jpg$
Allow: /*.png$

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /admin

# Disallow authentication pages
Disallow: /auth/

# Allow feed and sitemap
Allow: /feed.xml
Allow: /sitemap.xml

# Crawl rate limit (be gentle with our server)
Crawl-delay: 1

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/feed.xml

# Specific bot rules
User-agent: Googlebot
Allow: /
Crawl-delay: 0

User-agent: Bingbot
Allow: /
Crawl-delay: 0

User-agent: Slurp
Allow: /
Crawl-delay: 1

# Block bad bots
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

User-agent: DotBot
Crawl-delay: 10

# Block scraping bots
User-agent: MJ12bot
Disallow: /

User-agent: SemrushBot
Disallow: /api/

User-agent: AhrefsBot
Disallow: /api/
`

  return new NextResponse(robotsTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  })
}
