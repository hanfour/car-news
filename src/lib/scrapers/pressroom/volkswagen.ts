/**
 * Volkswagen Newsroom 爬蟲
 *
 * Volkswagen Newsroom 使用標準 HTML 結構
 * - www.volkswagen-newsroom.com
 *
 * 圖片託管在 uploads.vw-mms.de
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { BasePressroomScraper, cleanText, htmlToText } from './base'
import type { PressroomArticle, PressroomImage } from './types'
import { PRESSROOM_CONFIGS } from './types'

export class VolkswagenScraper extends BasePressroomScraper {
  constructor() {
    const config = PRESSROOM_CONFIGS.volkswagen
    if (!config) {
      throw new Error('Volkswagen config not found')
    }
    super(config)
  }

  /**
   * 解析文章列表頁
   */
  protected async parseArticleList(html: string): Promise<string[]> {
    const $ = this.parseHtml(html)
    const urls: string[] = []

    // Volkswagen 文章連結格式：/en/press-releases/[slug]-[ID]
    $('a[href*="/en/press-releases/"]').each((_: number, el: Element) => {
      const href = $(el).attr('href')
      if (href && this.isValidArticleUrl(href)) {
        const fullUrl = href.startsWith('http')
          ? href
          : `${this.config.baseUrl}${href}`
        urls.push(fullUrl)
      }
    })

    // 去重
    return [...new Set(urls)]
  }

  /**
   * 檢查是否為有效的文章 URL
   */
  private isValidArticleUrl(url: string): boolean {
    // 文章 URL 格式：/en/press-releases/[slug]-[ID]
    // ID 為數字，如 emily-cox-becomes-volkswagen-brand-ambassador-20051
    const pattern = /\/en\/press-releases\/[a-z0-9-]+-\d+$/i
    return pattern.test(url)
  }

  /**
   * 解析單篇文章
   */
  protected async parseArticle(url: string, html: string): Promise<PressroomArticle | null> {
    const $ = this.parseHtml(html)

    // 1. 提取標題
    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text()

    if (!title) {
      console.warn(`[Volkswagen] No title found for ${url}`)
      return null
    }

    // 2. 解析發布時間（格式：MM/DD/YY 或 December 29, 2025）
    const dateText = this.findDateText($)
    const publishedAt = this.parseDate(dateText)

    // 3. 提取分類
    const category = this.extractCategory($)

    // 4. 提取內容
    const contentEl = $('article, .article-content, .press-release-content, main').first()
    contentEl.find('nav, .related, .share-buttons, .breadcrumb, header, footer').remove()
    const content = contentEl.length > 0 ? htmlToText(contentEl.html() || '') : ''

    if (!content) {
      console.warn(`[Volkswagen] No content found for ${url}`)
      return null
    }

    // 5. 提取圖片
    const images = this.extractImages($)

    // 6. 提取車款
    const models = this.extractModels(title + ' ' + content)

    return {
      source: new URL(url).hostname,
      sourceType: 'official',
      brand: 'Volkswagen',
      url,
      title: cleanText(title),
      summary: cleanText($('meta[property="og:description"]').attr('content') || content.slice(0, 300)),
      content: cleanText(content),
      publishedAt,
      images,
      featuredImage: images[0],
      category,
      tags: category ? [category] : [],
      models,
    }
  }

  /**
   * 尋找日期文字
   */
  private findDateText($: ReturnType<typeof cheerio.load>): string {
    // 嘗試多種選擇器
    const selectors = [
      '.date',
      '.article-date',
      'time',
      '[datetime]',
      '.press-release-date',
    ]

    for (const selector of selectors) {
      const el = $(selector).first()
      const datetime = el.attr('datetime')
      if (datetime) return datetime

      const text = el.text().trim()
      if (text && /\d/.test(text)) {
        return text
      }
    }

    // 嘗試從頁面文字中提取
    const bodyText = $('body').text()
    const match = bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)
    return match ? match[1] : ''
  }

  /**
   * 解析日期
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date()

    try {
      // ISO 格式
      if (dateStr.includes('-') && dateStr.includes('T')) {
        return new Date(dateStr)
      }

      // MM/DD/YY 格式
      const shortMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/)
      if (shortMatch) {
        const [, month, day, year] = shortMatch
        const fullYear = parseInt(year) + 2000
        return new Date(fullYear, parseInt(month) - 1, parseInt(day))
      }

      // MM/DD/YYYY 格式
      const longMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (longMatch) {
        const [, month, day, year] = longMatch
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }

      // 嘗試直接解析
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    } catch (e) {
      console.warn(`[Volkswagen] Failed to parse date: ${dateStr}`)
    }

    return new Date()
  }

  /**
   * 提取分類
   */
  private extractCategory($: ReturnType<typeof cheerio.load>): string | undefined {
    const categoryEl = $('.category, .article-category, [class*="category"]').first()
    const category = categoryEl.text().trim()
    return category || undefined
  }

  /**
   * 提取文章中的圖片
   */
  private extractImages($: ReturnType<typeof cheerio.load>): PressroomImage[] {
    const images: PressroomImage[] = []
    const seenUrls = new Set<string>()

    // 1. 從 og:image 獲取主圖
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage && !seenUrls.has(ogImage)) {
      seenUrls.add(ogImage)
      images.push({
        url: ogImage,
        highResUrl: this.getHighResUrl(ogImage),
        credit: this.createImageCredit(),
      })
    }

    // 2. 從 vw-mms.de CDN 提取
    $('img[src*="vw-mms.de"], img[src*="uploads.vw"]').each((_: number, el: Element) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      seenUrls.add(src)
      const alt = $(el).attr('alt') || ''

      images.push({
        url: src,
        highResUrl: this.getHighResUrl(src),
        caption: cleanText(alt),
        credit: this.createImageCredit(),
      })
    })

    // 3. 從文章內容提取其他圖片
    $('article img, .article-content img, main img').each((_: number, el: Element) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      // 過濾非內容圖片
      if (src.includes('icon') || src.includes('logo') || src.includes('avatar')) {
        return
      }

      seenUrls.add(src)
      const alt = $(el).attr('alt') || ''

      const fullUrl = src.startsWith('http')
        ? src
        : `${this.config.baseUrl}${src}`

      images.push({
        url: fullUrl,
        highResUrl: this.getHighResUrl(src),
        caption: cleanText(alt),
        credit: this.createImageCredit(),
      })
    })

    return images
  }

  /**
   * 獲取高解析度版本
   */
  private getHighResUrl(url: string): string | undefined {
    if (!url.includes('vw-mms.de')) return undefined

    // VW 圖片通常有 _web_1600 後綴，嘗試獲取更大版本
    const highRes = url
      .replace(/_web_\d+/, '_web_2400')
      .replace(/\?\d+$/, '')  // 移除時間戳

    return highRes !== url ? highRes : undefined
  }

  /**
   * 從標題和內容中提取車款名稱
   */
  private extractModels(text: string): string[] {
    const models: string[] = []

    // Volkswagen 車款
    const vwModels = [
      // 轎車
      'Jetta', 'Passat', 'Arteon',
      // SUV
      'Tiguan', 'Atlas', 'Atlas Cross Sport', 'Taos', 'ID.4', 'ID.Buzz', 'ID.7',
      // 跑車
      'Golf', 'Golf GTI', 'Golf R',
      // 電動車
      'ID.3', 'ID.5', 'ID.6',
      // 經典
      'Beetle', 'Bus', 'Microbus',
    ]

    for (const model of vwModels) {
      const regex = new RegExp(`\\b${model.replace(/\./g, '\\.')}\\b`, 'i')
      if (regex.test(text)) {
        models.push(model)
      }
    }

    return [...new Set(models)]
  }
}

/**
 * 建立 Volkswagen 爬蟲實例
 */
export function createVolkswagenScraper(): VolkswagenScraper {
  return new VolkswagenScraper()
}
