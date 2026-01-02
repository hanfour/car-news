/**
 * BMW Group Pressroom 爬蟲
 *
 * BMW PressClub 使用 AJAX 動態載入文章列表
 * - www.press.bmwgroup.com/global
 *
 * 圖片託管在 mediapool.bmwgroup.com
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { BasePressroomScraper, cleanText, htmlToText } from './base'
import type { PressroomArticle, PressroomImage } from './types'
import { PRESSROOM_CONFIGS } from './types'

export class BMWScraper extends BasePressroomScraper {
  constructor() {
    const config = PRESSROOM_CONFIGS.bmw
    if (!config) {
      throw new Error('BMW config not found')
    }
    super(config)
  }

  /**
   * 解析文章列表頁（AJAX 端點）
   */
  protected async parseArticleList(html: string): Promise<string[]> {
    const $ = this.parseHtml(html)
    const urls: string[] = []

    // BMW 使用 data-id 屬性標記文章
    $('[data-id]').each((_, el) => {
      const id = $(el).attr('data-id')
      if (id && id.match(/^T\d+[A-Z]{2}$/)) {
        // 從連結或自行構造 URL
        const link = $(el).find('a[href*="/article/detail/"]').first().attr('href')
        if (link) {
          const fullUrl = link.startsWith('http') ? link : `${this.config.baseUrl}${link}`
          urls.push(fullUrl)
        } else {
          // 使用 ID 構造 URL
          urls.push(`${this.config.baseUrl}/global/article/detail/${id}`)
        }
      }
    })

    // 備用：從連結中提取
    if (urls.length === 0) {
      $('a[href*="/article/detail/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`
          // 確保是有效的文章 URL
          if (fullUrl.includes('/article/detail/T')) {
            urls.push(fullUrl)
          }
        }
      })
    }

    // 去重
    return [...new Set(urls)]
  }

  /**
   * 解析單篇文章
   */
  protected async parseArticle(url: string, html: string): Promise<PressroomArticle | null> {
    const $ = this.parseHtml(html)

    // 1. 提取文章 ID
    const idMatch = url.match(/\/article\/detail\/(T\d+[A-Z]{2})/)
    const articleId = idMatch ? idMatch[1] : null

    // 2. 提取標題
    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text()

    if (!title) {
      console.warn(`[BMW] No title found for ${url}`)
      return null
    }

    // 3. 解析發布時間（格式：Tue Dec 30 10:02:30 CET 2025）
    const timestampText = $('.timestamp, .article-date, time').first().text().trim()
    const publishedAt = this.parseBMWDate(timestampText)

    // 4. 提取內容
    const contentEl = $('.article-detail, .article-content, .content-main, article').first()
    // 移除下載區域和相關文章
    contentEl.find('.download-section, .related-articles, .media-section').remove()
    const content = contentEl.length > 0 ? htmlToText(contentEl.html() || '') : ''

    if (!content) {
      console.warn(`[BMW] No content found for ${url}`)
      return null
    }

    // 5. 提取圖片
    const images = this.extractImages($, articleId)

    // 6. 提取分類標籤
    const tags: string[] = []
    $('.article-tag, .tag-item, [class*="tag"]').each((_, el) => {
      const tag = $(el).text().trim()
      if (tag && tag.length < 50) {
        tags.push(tag)
      }
    })

    // 7. 提取車款
    const models = this.extractModels(title + ' ' + content)

    return {
      source: new URL(url).hostname,
      sourceType: 'official',
      brand: this.determineBrand(title, content, tags),
      url,
      title: cleanText(title),
      summary: cleanText($('meta[property="og:description"]').attr('content') || content.slice(0, 300)),
      content: cleanText(content),
      publishedAt,
      images,
      featuredImage: images[0],
      category: this.determineCategory(tags),
      tags,
      models,
    }
  }

  /**
   * 解析 BMW 日期格式
   * 格式：Tue Dec 30 10:02:30 CET 2025
   */
  private parseBMWDate(dateStr: string): Date {
    if (!dateStr) return new Date()

    try {
      // 嘗試直接解析
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }

      // 手動解析 BMW 格式
      const match = dateStr.match(/(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+\w+\s+(\d{4})/)
      if (match) {
        const [, , month, day, hour, min, sec, year] = match
        const months: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        }
        return new Date(
          parseInt(year),
          months[month] || 0,
          parseInt(day),
          parseInt(hour),
          parseInt(min),
          parseInt(sec)
        )
      }
    } catch (e) {
      console.warn(`[BMW] Failed to parse date: ${dateStr}`)
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
        highResUrl: this.getHighResUrl(ogImage),
        credit: this.createImageCredit(),
      })
    }

    // 2. 從 mediapool 連結提取
    $('img[src*="mediapool.bmwgroup.com"]').each((_: number, el: Element) => {
      const src = $(el).attr('src')
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

    // 3. 如果有文章 ID，建構下載連結
    if (articleId && images.length === 0) {
      const downloadUrl = `${this.config.baseUrl}/global/oneclick/download/${articleId}/photo`
      images.push({
        url: downloadUrl,
        credit: this.createImageCredit(),
      })
    }

    // 4. 從內容區提取其他圖片
    $('article img, .article-content img, .content-main img').each((_: number, el: Element) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      // 只要 BMW 相關圖片
      if (!src.includes('bmw') && !src.includes('mediapool')) return

      seenUrls.add(src)
      const alt = $(el).attr('alt') || ''

      images.push({
        url: this.resolveUrl(src),
        highResUrl: this.getHighResUrl(src),
        caption: cleanText(alt),
        credit: this.createImageCredit(),
      })
    })

    return images
  }

  /**
   * 嘗試獲取高解析度版本
   * BMW 圖片 URL 通常包含尺寸資訊
   */
  private getHighResUrl(url: string): string | undefined {
    if (!url.includes('mediapool.bmwgroup.com')) return undefined

    // mediapool 圖片格式：...-1200x800px.jpg
    // 嘗試替換為更大尺寸
    const highRes = url
      .replace(/\d+x\d+px/, '2400x1600px')
      .replace(/\d+px/, '2400px')

    return highRes !== url ? highRes : undefined
  }

  /**
   * 判斷具體品牌（BMW Group 包含多個品牌）
   */
  private determineBrand(title: string, content: string, tags: string[]): string {
    const text = (title + ' ' + content + ' ' + tags.join(' ')).toLowerCase()

    if (text.includes('mini') && !text.includes('minimis')) {
      return 'MINI'
    }
    if (text.includes('rolls-royce') || text.includes('rolls royce')) {
      return 'Rolls-Royce'
    }
    if (text.includes('bmw motorrad')) {
      return 'BMW Motorrad'
    }

    return 'BMW'
  }

  /**
   * 確定分類
   */
  private determineCategory(tags: string[]): string | undefined {
    const categoryMap: Record<string, string> = {
      'motorsport': 'Motorsport',
      'corporate': 'Corporate',
      'sustainability': 'Sustainability',
      'technology': 'Technology',
      'product': 'Product',
      'design': 'Design',
    }

    for (const tag of tags) {
      const lower = tag.toLowerCase()
      for (const [key, value] of Object.entries(categoryMap)) {
        if (lower.includes(key)) {
          return value
        }
      }
    }

    return tags[0]
  }

  /**
   * 從標題和內容中提取車款名稱
   */
  private extractModels(text: string): string[] {
    const models: string[] = []

    // BMW 車款
    const bmwModels = [
      // 轎車
      '1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series',
      // SUV/SAV
      'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM',
      // 電動車
      'iX', 'iX1', 'iX2', 'iX3', 'i4', 'i5', 'i7', 'iX M60',
      // M 系列
      'M2', 'M3', 'M4', 'M5', 'M8', 'M135i', 'M235i', 'M340i', 'M440i', 'M550i', 'M760i',
      // Z 系列
      'Z4',
    ]

    // MINI 車款
    const miniModels = [
      'Cooper', 'Countryman', 'Clubman', 'Paceman', 'John Cooper Works', 'JCW',
    ]

    const allModels = [...bmwModels, ...miniModels]

    for (const model of allModels) {
      const regex = new RegExp(`\\b${model.replace(/\s+/g, '\\s*')}\\b`, 'i')
      if (regex.test(text)) {
        models.push(model)
      }
    }

    return [...new Set(models)]
  }
}

/**
 * 建立 BMW 爬蟲實例
 */
export function createBMWScraper(): BMWScraper {
  return new BMWScraper()
}
