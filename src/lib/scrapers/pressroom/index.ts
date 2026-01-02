/**
 * 官方 Pressroom 爬蟲統一入口
 */

export * from './types'
export * from './base'
export { createLexusScraper, createToyotaScraper, LexusToyotaScraper } from './lexus-toyota'
export { createBMWScraper, BMWScraper } from './bmw'
export { createPorscheScraper, PorscheScraper } from './porsche'
export { createVolkswagenScraper, VolkswagenScraper } from './volkswagen'
export { createKiaScraper, KiaScraper } from './kia'

import { createLexusScraper, createToyotaScraper } from './lexus-toyota'
import { createBMWScraper } from './bmw'
import { createPorscheScraper } from './porsche'
import { createVolkswagenScraper } from './volkswagen'
import { createKiaScraper } from './kia'
import { createServiceClient } from '@/lib/supabase'
import type { ScraperResult, PressroomArticle } from './types'
import { SUPPORTED_PRESSROOM_BRANDS } from './types'

/**
 * 執行所有支援品牌的 Pressroom 爬蟲
 */
export async function scrapeAllPressrooms(brands?: string[]): Promise<{
  results: Record<string, ScraperResult>
  totalNew: number
  totalErrors: number
}> {
  const targetBrands = brands || ['lexus', 'toyota', 'bmw', 'porsche', 'volkswagen', 'kia']
  const results: Record<string, ScraperResult> = {}
  let totalNew = 0
  let totalErrors = 0

  // 獲取已存在的文章 URL
  const existingUrls = await getExistingOfficialUrls()

  for (const brand of targetBrands) {
    try {
      let scraper

      switch (brand.toLowerCase()) {
        case 'lexus':
          scraper = createLexusScraper()
          break
        case 'toyota':
          scraper = createToyotaScraper()
          break
        case 'bmw':
          scraper = createBMWScraper()
          break
        case 'porsche':
          scraper = createPorscheScraper()
          break
        case 'volkswagen':
          scraper = createVolkswagenScraper()
          break
        case 'kia':
          scraper = createKiaScraper()
          break
        // TODO: 新增更多品牌（Mercedes-Benz, Audi, Ford, Honda, Hyundai - 需要處理防爬機制）
        default:
          console.warn(`[Pressroom] Unknown brand: ${brand}`)
          continue
      }

      // 設定已存在的 URL
      scraper.setExistingUrls(existingUrls)

      // 執行爬蟲
      const result = await scraper.scrape()
      results[brand] = result

      totalNew += result.stats.new
      totalErrors += result.errors.length

      // 儲存新文章到資料庫
      if (result.articles.length > 0) {
        await saveArticlesToDatabase(result.articles)
      }

    } catch (error) {
      console.error(`[Pressroom] Error scraping ${brand}:`, error)
      results[brand] = {
        success: false,
        articles: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        stats: { total: 0, new: 0, skipped: 0, failed: 1 }
      }
      totalErrors++
    }
  }

  return { results, totalNew, totalErrors }
}

/**
 * 獲取資料庫中已存在的官方文章 URL
 */
async function getExistingOfficialUrls(): Promise<string[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('raw_articles')
    .select('url')
    .eq('source_type', 'official')

  if (error) {
    console.error('[Pressroom] Error fetching existing URLs:', error)
    return []
  }

  return data?.map(row => row.url) || []
}

/**
 * 將爬取的文章儲存到資料庫
 */
async function saveArticlesToDatabase(articles: PressroomArticle[]): Promise<number> {
  const supabase = createServiceClient()
  let savedCount = 0

  for (const article of articles) {
    try {
      // 計算過期時間（30 天後）
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // 選擇最佳圖片
      const bestImage = article.featuredImage || article.images[0]

      const { error } = await supabase
        .from('raw_articles')
        .upsert({
          url: article.url,
          title: article.title,
          content: article.content,
          source: article.source,
          source_type: 'official',  // 標記為官方來源
          published_at: article.publishedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          embedding: null,
          image_url: bestImage?.highResUrl || bestImage?.url || null,
          image_credit: bestImage?.credit || `${article.brand} Official`,
        }, {
          onConflict: 'url'
        })

      if (error) {
        console.error(`[Pressroom] Error saving article ${article.url}:`, error)
      } else {
        savedCount++
      }
    } catch (error) {
      console.error(`[Pressroom] Error processing article ${article.url}:`, error)
    }
  }

  console.log(`[Pressroom] Saved ${savedCount}/${articles.length} articles to database`)
  return savedCount
}

/**
 * 獲取支援的品牌列表
 */
export function getSupportedBrands(): string[] {
  return SUPPORTED_PRESSROOM_BRANDS
}
