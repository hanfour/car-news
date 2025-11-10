import sources from '@/config/sources.json'
import { NewsSource } from '@/types/database'
import { parseRSSFeed, ScrapedArticle } from './rss-parser'
import { fetchWebpage, extractTextFromHtml } from './fetcher'

export async function scrapeAllSources(): Promise<ScrapedArticle[]> {
  const enabledSources = sources.filter((s) => s.enabled) as NewsSource[]
  const allArticles: ScrapedArticle[] = []

  for (const source of enabledSources) {
    try {
      console.log(`Scraping ${source.name}...`)

      let articles: ScrapedArticle[] = []

      if (source.type === 'rss') {
        articles = await parseRSSFeed(source as NewsSource)
      } else if (source.type === 'scrape') {
        // 网页抓取方式（暂未实现，可以后续扩展）
        console.warn(`Scrape type not implemented for ${source.name}`)
        continue
      }

      console.log(`  → Found ${articles.length} articles`)
      allArticles.push(...articles)
    } catch (error) {
      console.error(`Failed to scrape ${source.name}:`, error)
      // 继续处理其他源
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
