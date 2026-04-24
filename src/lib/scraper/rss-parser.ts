import Parser from 'rss-parser'
import { NewsSource } from '@/types/database'
import { logger } from '@/lib/logger'

const parser = new Parser({
  timeout: 30000,
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
    let ogFetchCount = 0
    const MAX_OG_FETCHES = 10 // 每個 feed 最多 fetch 10 個文章頁面

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

      // 方法3: fetch 文章頁面 HTML，提取 og:image / twitter:image（每 feed 上限 10 次）
      if (!imageUrl && item.link && ogFetchCount < MAX_OG_FETCHES) {
        ogFetchCount++
        try {
          imageUrl = await fetchOgImage(item.link)
        } catch {
          // 靜默跳過，不影響主流程
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
    logger.error('scraper.rss.parse_fail', error, { source: source.name, url: source.url })
    return []
  }
}

/**
 * Fetch 文章頁面 HTML（前 50KB）提取 og:image / twitter:image
 * 5 秒 timeout，失敗回傳 undefined
 */
async function fetchOgImage(articleUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!response.ok || !response.body) return undefined

    // 只讀前 50KB 避免浪費頻寬
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const MAX_BYTES = 50 * 1024

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      totalBytes += value.length
    }
    reader.cancel()

    const html = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : Buffer.concat(chunks)
    )

    // 提取 og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/)
    if (ogMatch?.[1]) return ogMatch[1]

    // 提取 twitter:image
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/)
    if (twMatch?.[1]) return twMatch[1]

    return undefined
  } catch {
    return undefined
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
