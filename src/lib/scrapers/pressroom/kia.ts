/**
 * Kia Media 爬蟲
 *
 * Kia Media 使用標準 HTML 結構
 * - www.kiamedia.com
 *
 * 圖片使用動態路徑
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { BasePressroomScraper, cleanText, htmlToText } from './base'
import type { PressroomArticle, PressroomImage } from './types'
import { PRESSROOM_CONFIGS } from './types'

export class KiaScraper extends BasePressroomScraper {
  constructor() {
    const config = PRESSROOM_CONFIGS.kia
    if (!config) {
      throw new Error('Kia config not found')
    }
    super(config)
  }

  /**
   * 解析文章列表頁
   */
  protected async parseArticleList(html: string): Promise<string[]> {
    const $ = this.parseHtml(html)
    const urls: string[] = []

    // Kia 文章連結格式：/us/en/media/pressreleases/[ID]/[slug]
    $('a[href*="/media/pressreleases/"]').each((_: number, el: Element) => {
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
    // 文章 URL 格式：/us/en/media/pressreleases/[ID]/[slug]
    // 排除 list 頁面
    if (url.includes('/list') || url.endsWith('/pressreleases')) {
      return false
    }
    const pattern = /\/media\/pressreleases\/\d+\//i
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
      console.warn(`[Kia] No title found for ${url}`)
      return null
    }

    // 2. 提取文章 ID
    const idMatch = url.match(/\/pressreleases\/(\d+)\//)
    const articleId = idMatch ? idMatch[1] : null

    // 3. 解析發布時間（格式：MM/DD/YY）
    const dateText = this.findDateText($, html)
    const publishedAt = this.parseDate(dateText)

    // 4. 提取內容
    const contentEl = $('article, .article-content, .press-release-content, .release-content, main').first()
    contentEl.find('nav, .related, .share-buttons, .breadcrumb, header, footer, .download-section').remove()
    const content = contentEl.length > 0 ? htmlToText(contentEl.html() || '') : ''

    if (!content) {
      console.warn(`[Kia] No content found for ${url}`)
      return null
    }

    // 5. 提取圖片
    const images = this.extractImages($, articleId)

    // 6. 提取車款
    const models = this.extractModels(title + ' ' + content)

    return {
      source: new URL(url).hostname,
      sourceType: 'official',
      brand: 'Kia',
      url,
      title: cleanText(title),
      summary: cleanText($('meta[property="og:description"]').attr('content') || content.slice(0, 300)),
      content: cleanText(content),
      publishedAt,
      images,
      featuredImage: images[0],
      category: 'Press Release',
      tags: ['Press Release'],
      models,
    }
  }

  /**
   * 尋找日期文字
   */
  private findDateText($: ReturnType<typeof cheerio.load>, html: string): string {
    // 嘗試多種選擇器
    const selectors = [
      '.date',
      '.article-date',
      '.release-date',
      'time',
      '[datetime]',
    ]

    for (const selector of selectors) {
      const el = $(selector).first()
      const datetime = el.attr('datetime')
      if (datetime) return datetime

      const text = el.text().trim()
      if (text && /\d{1,2}\/\d{1,2}\/\d{2}/.test(text)) {
        return text
      }
    }

    // 嘗試從頁面文字中提取 MM/DD/YY 格式
    const match = html.match(/(\d{1,2}\/\d{1,2}\/\d{2})\s*ID:/i)
    return match ? match[1] : ''
  }

  /**
   * 解析日期
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date()

    try {
      // MM/DD/YY 格式
      const shortMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/)
      if (shortMatch) {
        const [, month, day, year] = shortMatch
        const fullYear = parseInt(year) + 2000
        return new Date(fullYear, parseInt(month) - 1, parseInt(day))
      }

      // 嘗試直接解析
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    } catch (e) {
      console.warn(`[Kia] Failed to parse date: ${dateStr}`)
    }

    return new Date()
  }

  /**
   * 提取文章中的圖片
   */
  private extractImages($: ReturnType<typeof cheerio.load>, articleId: string | null): PressroomImage[] {
    const images: PressroomImage[] = []
    const seenUrls = new Set<string>()

    // 1. 從 og:image 獲取主圖
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage && !seenUrls.has(ogImage)) {
      seenUrls.add(ogImage)
      images.push({
        url: ogImage,
        credit: this.createImageCredit(),
      })
    }

    // 2. 從 Kia 圖片路徑提取
    $('img[src*="/image/"], img[src*="kiamedia"]').each((_: number, el: Element) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      seenUrls.add(src)
      const alt = $(el).attr('alt') || ''

      const fullUrl = src.startsWith('http')
        ? src
        : `${this.config.baseUrl}${src}`

      images.push({
        url: fullUrl,
        highResUrl: this.getHighResUrl(fullUrl),
        caption: cleanText(alt),
        credit: this.createImageCredit(),
      })
    })

    // 3. 如果有文章 ID，建構高解析度下載連結
    if (articleId && images.length === 0) {
      const downloadUrl = `${this.config.baseUrl}/us/en/download/${articleId}/extrawidephoto/jpg`
      images.push({
        url: downloadUrl,
        credit: this.createImageCredit(),
      })
    }

    // 4. 從文章內容提取其他圖片
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
    // Kia 圖片路徑格式：/image/[type]/[ID]/...
    // 嘗試替換為高解析度版本
    if (url.includes('/croppedthumb/') || url.includes('/squarephoto/')) {
      return url
        .replace('/croppedthumb/', '/extrawidephoto/')
        .replace('/squarephoto/', '/extrawidephoto/')
    }
    return undefined
  }

  /**
   * 從標題和內容中提取車款名稱
   */
  private extractModels(text: string): string[] {
    const models: string[] = []

    // Kia 車款
    const kiaModels = [
      // SUV
      'Telluride', 'Sorento', 'Sportage', 'Seltos', 'Niro', 'Soul',
      // 轎車
      'K5', 'Forte', 'Rio', 'Stinger',
      // 電動車
      'EV6', 'EV9', 'EV5', 'EV3', 'Niro EV',
      // MPV
      'Carnival',
      // 皮卡
      'Tasman',
    ]

    for (const model of kiaModels) {
      const regex = new RegExp(`\\b${model}\\b`, 'i')
      if (regex.test(text)) {
        models.push(model)
      }
    }

    return [...new Set(models)]
  }
}

/**
 * 建立 Kia 爬蟲實例
 */
export function createKiaScraper(): KiaScraper {
  return new KiaScraper()
}
