import Parser from 'rss-parser'
import { fetchTranscript } from 'youtube-transcript'
import { NewsSource } from '@/types/database'
import { ScrapedArticle } from './rss-parser'
import { logger } from '@/lib/logger'

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)'
  }
})

const CONCURRENCY_LIMIT = 5
const MAX_CONTENT_LENGTH = 5000

/**
 * 從影片 URL 提取 videoId
 */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|\/vi?\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

/**
 * 取得影片字幕並合併為完整文字
 */
async function getVideoTranscript(videoId: string, lang?: string): Promise<string | null> {
  try {
    const segments = await fetchTranscript(videoId, lang ? { lang } : undefined)

    if (!segments || segments.length === 0) {
      return null
    }

    const fullText = segments
      .map((s: { text: string }) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    return fullText || null
  } catch {
    // 無字幕或取得失敗，靜默跳過
    return null
  }
}

/**
 * 並行處理但限制同時數量
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  const executing = new Set<Promise<void>>()

  for (const item of items) {
    const p = fn(item).then((result) => {
      results.push(result)
    }).catch(() => {
      // 個別項目失敗不影響其他
    }).finally(() => {
      executing.delete(p)
    })
    executing.add(p)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * 擷取 YouTube 頻道的影片逐字稿
 */
export async function scrapeYouTubeChannel(source: NewsSource): Promise<ScrapedArticle[]> {
  try {
    // YouTube 頻道 RSS feed (Atom 格式)
    const feed = await parser.parseURL(source.url)
    const articles: ScrapedArticle[] = []

    if (!feed.items || feed.items.length === 0) {
      logger.info('scraper.youtube.no_videos', { source: source.name })
      return []
    }

    // 並行取得字幕，限制同時 5 個
    const videoItems = feed.items.filter((item) => item.link && item.title)

    await mapWithConcurrency(
      videoItems,
      async (item) => {
        const videoId = extractVideoId(item.link!)
        if (!videoId) return

        const transcript = await getVideoTranscript(videoId, source.lang)
        if (!transcript || transcript.length < 50) return

        // 安全解析日期
        let publishedAt: Date | undefined
        if (item.pubDate || item.isoDate) {
          const parsed = new Date((item.isoDate || item.pubDate) as string)
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed
          }
        }

        articles.push({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: item.title!,
          content: transcript.slice(0, MAX_CONTENT_LENGTH),
          publishedAt,
          source: source.name,
          imageUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
        })
      },
      CONCURRENCY_LIMIT
    )

    // 按發布時間排序（新 → 舊）
    return articles.sort((a, b) => {
      if (!a.publishedAt || !b.publishedAt) return 0
      return b.publishedAt.getTime() - a.publishedAt.getTime()
    })
  } catch (error) {
    logger.error('scraper.youtube.scrape_fail', error, { source: source.name, url: source.url })
    return []
  }
}
