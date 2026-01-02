/**
 * Pressroom 爬蟲基礎類別
 */

import * as cheerio from 'cheerio'
import { getErrorMessage } from '@/lib/utils/error'
import type {
  PressroomArticle,
  PressroomImage,
  PressroomScraperConfig,
  ScraperResult
} from './types'

/**
 * 基礎 Pressroom 爬蟲
 * 各品牌爬蟲繼承此類別並實作 parseArticleList 和 parseArticle 方法
 */
export abstract class BasePressroomScraper {
  protected config: PressroomScraperConfig
  protected existingUrls: Set<string> = new Set()

  constructor(config: PressroomScraperConfig) {
    this.config = config
  }

  /**
   * 設定已存在的文章 URL（用於跳過重複）
   */
  setExistingUrls(urls: string[]): void {
    this.existingUrls = new Set(urls)
  }

  /**
   * 執行爬蟲
   */
  async scrape(): Promise<ScraperResult> {
    const result: ScraperResult = {
      success: false,
      articles: [],
      errors: [],
      stats: { total: 0, new: 0, skipped: 0, failed: 0 }
    }

    try {
      console.log(`[${this.config.brand}] Starting pressroom scrape...`)
      console.log(`   URL: ${this.config.newsListUrl}`)

      // 1. 獲取文章列表
      const listHtml = await this.fetchPage(this.config.newsListUrl)
      const articleUrls = await this.parseArticleList(listHtml)

      console.log(`[${this.config.brand}] Found ${articleUrls.length} articles`)
      result.stats.total = articleUrls.length

      // 2. 過濾已存在的文章
      const newUrls = articleUrls.filter(url => !this.existingUrls.has(url))
      result.stats.skipped = articleUrls.length - newUrls.length

      if (newUrls.length === 0) {
        console.log(`[${this.config.brand}] No new articles found`)
        result.success = true
        return result
      }

      console.log(`[${this.config.brand}] ${newUrls.length} new articles to process`)

      // 3. 限制數量
      const urlsToProcess = newUrls.slice(0, this.config.maxArticles || 20)

      // 4. 爬取每篇文章
      for (const url of urlsToProcess) {
        try {
          // 請求間隔
          if (this.config.requestDelay) {
            await this.delay(this.config.requestDelay)
          }

          const articleHtml = await this.fetchPage(url)
          const article = await this.parseArticle(url, articleHtml)

          if (article) {
            // 檢查文章是否在時間範圍內
            if (this.isWithinDateRange(article.publishedAt)) {
              result.articles.push(article)
              result.stats.new++
              console.log(`[${this.config.brand}] ✓ ${article.title.slice(0, 50)}...`)
            } else {
              result.stats.skipped++
            }
          }
        } catch (error) {
          result.errors.push(`Failed to parse ${url}: ${getErrorMessage(error)}`)
          result.stats.failed++
        }
      }

      result.success = true
      console.log(`[${this.config.brand}] Scrape complete: ${result.stats.new} new articles`)

    } catch (error) {
      result.errors.push(getErrorMessage(error))
      console.error(`[${this.config.brand}] Scrape failed:`, getErrorMessage(error))
    }

    return result
  }

  /**
   * 抓取頁面 HTML
   */
  protected async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent ||
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.text()
  }

  /**
   * 解析文章列表頁，返回文章 URL 列表
   * 子類別必須實作
   */
  protected abstract parseArticleList(html: string): Promise<string[]>

  /**
   * 解析單篇文章
   * 子類別必須實作
   */
  protected abstract parseArticle(url: string, html: string): Promise<PressroomArticle | null>

  /**
   * 檢查日期是否在範圍內
   */
  protected isWithinDateRange(date: Date): boolean {
    if (!this.config.maxAgeDays) return true

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - this.config.maxAgeDays)

    return date >= cutoff
  }

  /**
   * 延遲函數
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 建立 Cheerio 實例
   */
  protected parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html)
  }

  /**
   * 將相對 URL 轉為絕對 URL
   */
  protected resolveUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith('http')) {
      return relativeUrl
    }
    return new URL(relativeUrl, this.config.baseUrl).toString()
  }

  /**
   * 從圖片 URL 提取高解析度版本（如果有）
   */
  protected extractHighResImageUrl(url: string): string {
    // 移除常見的縮圖後綴
    return url
      .replace(/-\d+x\d+\./, '.')  // WordPress 風格：image-800x600.jpg -> image.jpg
      .replace(/\?.*$/, '')        // 移除 query string
  }

  /**
   * 建立標準的圖片來源標註
   */
  protected createImageCredit(): string {
    return `${this.config.brand} Official`
  }
}

/**
 * 工具函數：清理文字內容
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
}

/**
 * 工具函數：從 HTML 提取純文字
 */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html)
  // 移除 script 和 style
  $('script, style').remove()
  return cleanText($.text())
}
