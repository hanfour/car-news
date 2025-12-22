import Parser from 'rss-parser'
import { NewsSource } from '@/types/database'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)'
  }
})

export interface ScrapedArticle {
  url: string
  title: string
  content: string
  publishedAt?: Date
  source: string
  imageUrl?: string
}

export async function parseRSSFeed(source: NewsSource): Promise<ScrapedArticle[]> {
  try {
    const feed = await parser.parseURL(source.url)
    const articles: ScrapedArticle[] = []

    for (const item of feed.items) {
      if (!item.link || !item.title) continue

      // 提取内容（优先使用content，其次description）
      let content = ''
      if (item.content) {
        content = stripHtml(item.content)
      } else if (item.contentSnippet) {
        content = item.contentSnippet
      } else if (item.summary) {
        content = stripHtml(item.summary)
      }

      // 过滤太短的内容（降低門檻以保留更多摘要型 RSS）
      // 很多 RSS feed 只提供簡短摘要，AI generator 會抓取全文補充
      if (content.length < 50) {
        continue
      }

      // 提取图片 URL
      // RSS Feed 通常在 enclosure 或 media:content 中包含图片
      let imageUrl: string | undefined

      // 方法1: 檢查 enclosure (podcast/media)
      if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
        imageUrl = item.enclosure.url
      }

      // 方法2: 檢查 content 中的圖片 (使用正則提取)
      if (!imageUrl && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/)
        if (imgMatch) {
          imageUrl = imgMatch[1]
        }
      }

      // 解碼 HTML 實體 (例如 &#038; -> &)
      if (imageUrl) {
        imageUrl = imageUrl
          .replace(/&#038;/g, '&')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
      }

      // 安全解析日期，避免無效日期導致 toISOString() 崩潰
      let publishedAt: Date | undefined
      if (item.pubDate) {
        const parsed = new Date(item.pubDate)
        // 檢查是否為有效日期
        if (!isNaN(parsed.getTime())) {
          publishedAt = parsed
        }
      }

      articles.push({
        url: item.link,
        title: item.title,
        content: content.slice(0, 5000), // 限制长度
        publishedAt,
        source: source.name,
        imageUrl
      })
    }

    return articles
  } catch (error) {
    console.error(`Failed to parse RSS feed ${source.name}:`, error)
    return []
  }
}

function stripHtml(html: string): string {
  // 简单的HTML标签移除
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
