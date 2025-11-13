import sources from '@/config/sources.json'
import { NewsSource } from '@/types/database'
import { parseRSSFeed, ScrapedArticle } from './rss-parser'
import { fetchWebpage, extractTextFromHtml } from './fetcher'

export async function scrapeAllSources(): Promise<ScrapedArticle[]> {
  const enabledSources = sources.filter((s) => s.enabled) as NewsSource[]

  console.log(`Scraping ${enabledSources.length} sources in parallel...`)

  // 並行處理所有來源（更快！）
  const results = await Promise.allSettled(
    enabledSources.map(async (source) => {
      try {
        console.log(`Scraping ${source.name}...`)

        if (source.type === 'rss') {
          const articles = await parseRSSFeed(source as NewsSource)
          console.log(`  → Found ${articles.length} articles from ${source.name}`)
          return articles
        } else if (source.type === 'scrape') {
          console.warn(`Scrape type not implemented for ${source.name}`)
          return []
        }
        return []
      } catch (error) {
        console.error(`Failed to scrape ${source.name}:`, error)
        return []
      }
    })
  )

  // 收集所有成功的結果
  const allArticles: ScrapedArticle[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value)
    }
  }

  // 去重（基于URL）
  const uniqueArticles = deduplicateByUrl(allArticles)
  console.log(`Total unique articles: ${uniqueArticles.length}`)

  return uniqueArticles
}

function deduplicateByUrl(articles: ScrapedArticle[]): ScrapedArticle[] {
  const seen = new Set<string>()
  return articles.filter(article => {
    if (seen.has(article.url)) {
      return false
    }
    seen.add(article.url)
    return true
  })
}

export type { ScrapedArticle }
