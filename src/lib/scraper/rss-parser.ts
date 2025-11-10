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

      // 过滤太短的内容
      if (content.length < 200) {
        continue
      }

      articles.push({
        url: item.link,
        title: item.title,
        content: content.slice(0, 5000), // 限制长度
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        source: source.name
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
