/**
 * Porsche Newsroom 爬蟲
 *
 * Porsche Newsroom 使用傳統 HTML 結構
 * - newsroom.porsche.com
 *
 * 圖片託管在 porschepictures.flowcenter.de
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { BasePressroomScraper, cleanText, htmlToText } from './base'
import type { PressroomArticle, PressroomImage } from './types'
import { PRESSROOM_CONFIGS } from './types'

export class PorscheScraper extends BasePressroomScraper {
  constructor() {
    const config = PRESSROOM_CONFIGS.porsche
    if (!config) {
      throw new Error('Porsche config not found')
    }
    super(config)
  }

  /**
   * 解析文章列表頁
   */
  protected async parseArticleList(html: string): Promise<string[]> {
    const $ = this.parseHtml(html)
    const urls: string[] = []

    // Porsche 文章連結格式：/en/YYYY/category/article-slug-number.html
    $('a[href*="/en/20"]').each((_, el) => {
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
    // 文章 URL 格式：/en/YYYY/category/slug-NUMBER.html
    const pattern = /\/en\/20\d{2}\/[a-z-]+\/[a-z0-9-]+-\d+\.html$/i
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
      console.warn(`[Porsche] No title found for ${url}`)
      return null
    }

    // 2. 解析發布時間（格式：DD/MM/YYYY）
    const dateText = this.findDateText($)
    const publishedAt = this.parsePorscheDate(dateText)

    // 3. 提取分類
    const category = this.extractCategory(url)

    // 4. 提取內容
    const contentEl = $('article, .article-content, .content-main, main').first()
    // 移除導航和相關區域
    contentEl.find('nav, .related, .share-buttons, .breadcrumb').remove()
    const content = contentEl.length > 0 ? htmlToText(contentEl.html() || '') : ''

    if (!content) {
      console.warn(`[Porsche] No content found for ${url}`)
      return null
    }

    // 5. 提取圖片
    const images = this.extractImages($, url)

    // 6. 提取車款
    const models = this.extractModels(title + ' ' + content)

    return {
      source: new URL(url).hostname,
      sourceType: 'official',
      brand: 'Porsche',
      url,
      title: cleanText(title),
      summary: cleanText($('meta[property="og:description"]').attr('content') || content.slice(0, 300)),
      content: cleanText(content),
      publishedAt,
      images,
      featuredImage: images[0],
      category,
      tags: [category].filter(Boolean) as string[],
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
    ]

    for (const selector of selectors) {
      const text = $(selector).first().text().trim()
      if (text && /\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) {
        return text
      }
    }

    // 嘗試從頁面文字中提取
    const bodyText = $('body').text()
    const match = bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
    return match ? match[1] : ''
  }

  /**
   * 解析 Porsche 日期格式
   * 格式：DD/MM/YYYY
   */
  private parsePorscheDate(dateStr: string): Date {
    if (!dateStr) return new Date()

    try {
      // DD/MM/YYYY
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (match) {
        const [, day, month, year] = match
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }

      // 嘗試直接解析
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    } catch (e) {
      console.warn(`[Porsche] Failed to parse date: ${dateStr}`)
    }

    return new Date()
  }

  /**
   * 從 URL 提取分類
   */
  private extractCategory(url: string): string | undefined {
    // URL 格式：/en/YYYY/category/slug.html
    const match = url.match(/\/en\/\d{4}\/([a-z-]+)\//)
    if (match) {
      const category = match[1]
      // 轉換為首字母大寫
      return category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ')
    }
    return undefined
  }

  /**
   * 提取文章中的圖片
   */
  private extractImages($: ReturnType<typeof cheerio.load>, articleUrl: string): PressroomImage[] {
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

    // 2. 從 flowcenter.de 連結提取
    $('img[src*="flowcenter.de"], img[data-src*="flowcenter.de"]').each((_: number, el: Element) => {
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

    // 3. 從 DAM 連結提取
    $('img[src*="/dam/"], img[data-src*="/dam/"]').each((_: number, el: Element) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

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

    // 4. 從文章內容提取其他圖片
    $('article img, .article-content img, main img').each((_: number, el: Element) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      // 過濾非內容圖片
      if (src.includes('placeholder') || src.includes('icon') || src.includes('logo')) {
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
   * flowcenter.de 圖片可以調整 w 和 h 參數
   */
  private getHighResUrl(url: string): string | undefined {
    if (!url.includes('flowcenter.de')) return undefined

    try {
      // 替換尺寸參數為更大的值
      const highRes = url
        .replace(/w=\d+/, 'w=2400')
        .replace(/h=\d+/, 'h=1600')

      return highRes !== url ? highRes : undefined
    } catch {
      return undefined
    }
  }

  /**
   * 從標題和內容中提取車款名稱
   */
  private extractModels(text: string): string[] {
    const models: string[] = []

    // Porsche 車款
    const porscheModels = [
      // 911 系列
      '911', '911 GT3', '911 GT3 RS', '911 Turbo', '911 Turbo S', '911 Carrera', '911 Targa', '911 Dakar',
      // 718 系列
      '718', '718 Cayman', '718 Boxster', '718 Cayman GT4', '718 Spyder',
      // SUV
      'Cayenne', 'Cayenne Turbo', 'Cayenne E-Hybrid',
      'Macan', 'Macan Electric',
      // 電動車
      'Taycan', 'Taycan Turbo', 'Taycan Cross Turismo',
      // 跑車
      'Panamera', 'Panamera Turbo',
      // 經典/限量
      'Carrera GT', '918 Spyder', 'Mission X',
    ]

    for (const model of porscheModels) {
      const regex = new RegExp(`\\b${model.replace(/\s+/g, '\\s*')}\\b`, 'i')
      if (regex.test(text)) {
        models.push(model)
      }
    }

    return [...new Set(models)]
  }
}

/**
 * 建立 Porsche 爬蟲實例
 */
export function createPorscheScraper(): PorscheScraper {
  return new PorscheScraper()
}
