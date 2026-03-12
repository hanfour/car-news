import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { POPULAR_BRANDS } from '@/config/brands'
import { CATEGORIES } from '@/config/categories'

export const revalidate = 3600

const ARTICLES_PER_PAGE = 500
const SITEMAP_INDEX_THRESHOLD = 1000

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const type = request.nextUrl.searchParams.get('type')
  const page = Number(request.nextUrl.searchParams.get('page') || '1')

  try {
    if (type === 'articles') {
      return generateArticlesSitemap(supabase, baseUrl, page)
    }

    if (type === 'pages') {
      return generatePagesSitemap(baseUrl)
    }

    // Default: /sitemap.xml — check if we need sitemap index
    const { count, error: countError } = await supabase
      .from('generated_articles')
      .select('id', { count: 'exact', head: true })
      .eq('published', true)

    if (countError) {
      console.error('[Sitemap] Error counting articles:', countError)
      return new NextResponse('Error generating sitemap', { status: 500 })
    }

    const totalArticles = count || 0

    if (totalArticles > SITEMAP_INDEX_THRESHOLD) {
      return generateSitemapIndex(baseUrl, totalArticles)
    }

    return generateCombinedSitemap(supabase, baseUrl)

  } catch (error) {
    console.error('[Sitemap] Unexpected error:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}

function generateSitemapIndex(baseUrl: string, totalArticles: number) {
  const totalPages = Math.ceil(totalArticles / ARTICLES_PER_PAGE)
  const now = new Date().toISOString().split('T')[0]

  let sitemaps = ''
  for (let i = 1; i <= totalPages; i++) {
    sitemaps += `  <sitemap>
    <loc>${baseUrl}/sitemap.xml?type=articles&amp;page=${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`
  }
  sitemaps += `  <sitemap>
    <loc>${baseUrl}/sitemap.xml?type=pages</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`

  return xmlResponse(xml)
}

async function generateArticlesSitemap(
  supabase: ReturnType<typeof createServiceClient>,
  baseUrl: string,
  page: number
) {
  const offset = (page - 1) * ARTICLES_PER_PAGE

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, published_at, title_zh')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + ARTICLES_PER_PAGE - 1)

  if (error) {
    console.error('[Sitemap] Error fetching articles:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }

  return buildArticlesXml(articles || [], baseUrl)
}

function generatePagesSitemap(baseUrl: string) {
  const now = new Date().toISOString().split('T')[0]
  let urls = ''

  urls += urlEntry(baseUrl, now, 'hourly', '1.0')
  urls += urlEntry(`${baseUrl}/latest`, now, 'hourly', '0.9')

  for (const brand of POPULAR_BRANDS) {
    urls += urlEntry(`${baseUrl}/brand/${encodeURIComponent(brand.name)}`, now, 'daily', '0.6')
  }

  for (const cat of CATEGORIES) {
    urls += urlEntry(`${baseUrl}/category/${encodeURIComponent(cat.slug)}`, now, 'daily', '0.6')
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return xmlResponse(xml)
}

async function generateCombinedSitemap(
  supabase: ReturnType<typeof createServiceClient>,
  baseUrl: string
) {
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, published_at, title_zh')
    .eq('published', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[Sitemap] Error fetching articles:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }

  const now = new Date().toISOString().split('T')[0]
  let pagesUrls = ''
  pagesUrls += urlEntry(baseUrl, now, 'hourly', '1.0')
  pagesUrls += urlEntry(`${baseUrl}/latest`, now, 'hourly', '0.9')

  for (const brand of POPULAR_BRANDS) {
    pagesUrls += urlEntry(`${baseUrl}/brand/${encodeURIComponent(brand.name)}`, now, 'daily', '0.6')
  }
  for (const cat of CATEGORIES) {
    pagesUrls += urlEntry(`${baseUrl}/category/${encodeURIComponent(cat.slug)}`, now, 'daily', '0.6')
  }

  const articlesXmlContent = (articles || []).map(article => {
    const publishedDate = new Date(article.published_at)
    const year = publishedDate.getFullYear()
    const month = String(publishedDate.getMonth() + 1).padStart(2, '0')
    const daysSincePublished = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))

    let priority = '0.7'
    let changefreq = 'monthly'
    if (daysSincePublished <= 1) { priority = '0.9'; changefreq = 'hourly' }
    else if (daysSincePublished <= 7) { priority = '0.8'; changefreq = 'daily' }
    else if (daysSincePublished <= 30) { priority = '0.7'; changefreq = 'weekly' }

    const escapedTitle = escapeXml(article.title_zh || '')

    return `  <url>
    <loc>${baseUrl}/${year}/${month}/${article.id}</loc>
    <lastmod>${article.published_at.split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <news:news>
      <news:publication>
        <news:name>玩咖 WANT CAR</news:name>
        <news:language>zh</news:language>
      </news:publication>
      <news:publication_date>${article.published_at}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
    </news:news>
  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${pagesUrls}
${articlesXmlContent}
</urlset>`

  return xmlResponse(xml)
}

function buildArticlesXml(
  articles: Array<{ id: string; published_at: string; title_zh: string }>,
  baseUrl: string
) {
  const articlesXml = articles.map(article => {
    const publishedDate = new Date(article.published_at)
    const year = publishedDate.getFullYear()
    const month = String(publishedDate.getMonth() + 1).padStart(2, '0')
    const daysSincePublished = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))

    let priority = '0.7'
    let changefreq = 'monthly'
    if (daysSincePublished <= 1) { priority = '0.9'; changefreq = 'hourly' }
    else if (daysSincePublished <= 7) { priority = '0.8'; changefreq = 'daily' }
    else if (daysSincePublished <= 30) { priority = '0.7'; changefreq = 'weekly' }

    const escapedTitle = escapeXml(article.title_zh || '')

    return `  <url>
    <loc>${baseUrl}/${year}/${month}/${article.id}</loc>
    <lastmod>${article.published_at.split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <news:news>
      <news:publication>
        <news:name>玩咖 WANT CAR</news:name>
        <news:language>zh</news:language>
      </news:publication>
      <news:publication_date>${article.published_at}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
    </news:news>
  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articlesXml}
</urlset>`

  return xmlResponse(xml)
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
