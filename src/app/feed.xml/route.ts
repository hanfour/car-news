/**
 * RSS Feed Generation
 * Generates RSS 2.0 feed for all published articles
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import RSS from 'rss'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'

export async function GET() {
  const supabase = createClient()

  // Fetch latest 50 published articles
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, cover_image, brands, categories')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  // Create RSS feed
  const feed = new RSS({
    title: '玩咖 WANT CAR - AI 驅動的玩車資訊聚合平台',
    description: '想要車？從數據到動力，AI 帶你玩懂車界未來。聚合全球汽車新聞，提供 Tesla、BMW、Mercedes 等品牌最新資訊。',
    feed_url: `${BASE_URL}/feed.xml`,
    site_url: BASE_URL,
    image_url: `${BASE_URL}/logo.png`,
    managingEditor: 'editor@wantcar.autos (玩咖 WANT CAR 編輯團隊)',
    webMaster: 'webmaster@wantcar.autos (玩咖 WANT CAR 技術團隊)',
    copyright: `© ${new Date().getFullYear()} WANT CAR`,
    language: 'zh-TW',
    categories: ['汽車', '電動車', '新車', '科技'],
    pubDate: new Date().toUTCString(),
    ttl: 60 // Cache for 60 minutes
  })

  // Add articles to feed
  articles?.forEach((article) => {
    // Generate article description (first 200 chars)
    const description = article.content_zh
      ? article.content_zh.slice(0, 200).trim() + '...'
      : article.title_zh

    // Extract year and month from published_at for URL
    const publishedDate = new Date(article.published_at)
    const year = publishedDate.getFullYear()
    const month = String(publishedDate.getMonth() + 1).padStart(2, '0')

    feed.item({
      title: article.title_zh,
      description,
      url: `${BASE_URL}/${year}/${month}/${article.id}`,
      guid: article.id,
      categories: [
        ...(article.brands || []),
        ...(article.categories || [])
      ],
      date: new Date(article.published_at),
      enclosure: article.cover_image ? {
        url: article.cover_image,
        type: 'image/webp'
      } : undefined
    })
  })

  // Generate XML
  const xml = feed.xml({ indent: true })

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
