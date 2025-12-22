import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const revalidate = 3600 // Revalidate every 1 hour

/**
 * Dynamic sitemap.xml generation
 *
 * Includes:
 * - Homepage
 * - All published articles
 * - Category pages
 * - Brand pages
 */
export async function GET() {
  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'

  try {
    // 1. Fetch all published articles
    const { data: articles, error } = await supabase
      .from('generated_articles')
      .select('id, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false })

    if (error) {
      console.error('[Sitemap] Error fetching articles:', error)
      return new NextResponse('Error generating sitemap', { status: 500 })
    }

    // 2. Build sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- Homepage -->
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Category Pages -->
  <url>
    <loc>${baseUrl}/category/news</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/category/reviews</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/category/technology</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/category/ev</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Articles -->
${articles?.map(article => {
  // Parse published_at to get year and month
  const publishedDate = new Date(article.published_at)
  const year = publishedDate.getFullYear()
  const month = String(publishedDate.getMonth() + 1).padStart(2, '0')

  // Determine priority based on article age
  const daysSincePublished = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
  let priority = '0.7'
  let changefreq = 'monthly'

  if (daysSincePublished <= 1) {
    priority = '0.9'
    changefreq = 'hourly'
  } else if (daysSincePublished <= 7) {
    priority = '0.8'
    changefreq = 'daily'
  } else if (daysSincePublished <= 30) {
    priority = '0.7'
    changefreq = 'weekly'
  }

  const lastmod = article.published_at

  return `  <url>
    <loc>${baseUrl}/${year}/${month}/${article.id}</loc>
    <lastmod>${lastmod.split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}).join('\n')}

</urlset>`

    return new NextResponse(sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
      }
    })

  } catch (error) {
    console.error('[Sitemap] Unexpected error:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}
