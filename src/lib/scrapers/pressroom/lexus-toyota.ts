/**
 * Lexus / Toyota Pressroom 爬蟲
 *
 * 兩個品牌使用相同的 WordPress 架構：
 * - pressroom.lexus.com
 * - pressroom.toyota.com
 *
 * 圖片託管在 AWS S3：lexus-cms-media.s3.us-east-2.amazonaws.com
 */

import { BasePressroomScraper, cleanText, htmlToText } from './base'
import type { PressroomArticle, PressroomImage, PressroomScraperConfig } from './types'
import { PRESSROOM_CONFIGS } from './types'

export class LexusToyotaScraper extends BasePressroomScraper {
  constructor(brand: 'lexus' | 'toyota') {
    const config = PRESSROOM_CONFIGS[brand]
    if (!config) {
      throw new Error(`Unknown brand: ${brand}`)
    }
    super(config)
  }

  /**
   * 解析文章列表頁
   * WordPress 首頁有最新文章，也可以用 /corporate/latest-news/
   */
  protected async parseArticleList(html: string): Promise<string[]> {
    const $ = this.parseHtml(html)
    const urls: string[] = []

    // 方法 1: 從 <article> 標籤中提取
    $('article.post-box').each((_, el) => {
      const link = $(el).find('a').first().attr('href')
      if (link && this.isValidArticleUrl(link)) {
        urls.push(link)
      }
    })

    // 方法 2: 從文章連結中提取（備用）
    if (urls.length === 0) {
      $('a[href*="pressroom.lexus.com/"], a[href*="pressroom.toyota.com/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href && this.isValidArticleUrl(href)) {
          urls.push(href)
        }
      })
    }

    // 去重
    return [...new Set(urls)]
  }

  /**
   * 檢查是否為有效的文章 URL（排除分類頁、產品頁等）
   */
  private isValidArticleUrl(url: string): boolean {
    const excludePatterns = [
      '/category/',
      '/products/',
      '/topic/',
      '/vehicle/',
      '/page/',
      '/wp-content/',
      '/event/',
      '/contacts/',
      '/whats-new',
      '/historic-vehicles/',
      '/cart/',
      '/pricing/',
      '/images-videos/',
      '/newsroom-connection/',
      '/media-events/',
      '/concept/',
      '/corporate/',
      '/motorsports/',
      '/product/',
      '/wp-json/',
      '/history-lexus/',
      '/feed/',
    ]

    // 檢查是否為排除的路徑
    for (const pattern of excludePatterns) {
      if (url.includes(pattern)) {
        return false
      }
    }

    // 確認是正確域名的文章
    const baseUrl = this.config.baseUrl
    if (!url.startsWith(baseUrl)) {
      return false
    }

    // 文章 URL 格式：/slug/
    const path = url.replace(baseUrl, '')
    const slugMatch = path.match(/^\/([a-z0-9\-]+)\/?$/)

    return !!slugMatch
  }

  /**
   * 解析單篇文章
   */
  protected async parseArticle(url: string, html: string): Promise<PressroomArticle | null> {
    const $ = this.parseHtml(html)

    // 1. 提取標題
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('h1.entry-title, h1.post-title').first().text() ||
                  $('title').text()

    if (!title) {
      console.warn(`[${this.config.brand}] No title found for ${url}`)
      return null
    }

    // 2. 提取發布時間
    const publishedTimeStr = $('meta[property="article:published_time"]').attr('content')
    const publishedAt = publishedTimeStr ? new Date(publishedTimeStr) : new Date()

    // 3. 提取內容
    const contentEl = $('.entry-content, .post-content, .article-content, .single-post--content').first()
    const content = contentEl.length > 0 ? htmlToText(contentEl.html() || '') : ''

    if (!content) {
      console.warn(`[${this.config.brand}] No content found for ${url}`)
      return null
    }

    // 4. 提取摘要
    const summary = $('meta[property="og:description"]').attr('content') ||
                   $('meta[name="description"]').attr('content') ||
                   content.slice(0, 300)

    // 5. 提取圖片
    const images = this.extractImages($, url)

    // 6. 提取分類
    const categories: string[] = []
    $('.post-category a, .entry-categories a, .category-tag').each((_, el) => {
      const cat = $(el).text().trim()
      if (cat) categories.push(cat)
    })

    // 7. 提取標籤/車款
    const models = this.extractModels(title + ' ' + content)

    return {
      source: new URL(url).hostname,
      sourceType: 'official',
      brand: this.config.brand,
      url,
      title: cleanText(title),
      summary: cleanText(summary),
      content: cleanText(content),
      publishedAt,
      images,
      featuredImage: images[0],
      category: categories[0],
      tags: categories,
      models,
    }
  }

  /**
   * 提取文章中的圖片
   */
  private extractImages($: cheerio.CheerioAPI, articleUrl: string): PressroomImage[] {
    const images: PressroomImage[] = []
    const seenUrls = new Set<string>()

    // 1. 優先提取高解析度特色圖片
    const featuredLink = $('a.featured-image-download-link, a.fancy-image-link')
    if (featuredLink.length > 0) {
      const highRes = featuredLink.attr('data-highres-src')
      const midRes = featuredLink.attr('href')
      const lowRes = featuredLink.attr('data-lowres-src')
      const caption = featuredLink.attr('data-image-title') || ''

      const imageUrl = highRes || midRes || lowRes
      if (imageUrl && !seenUrls.has(imageUrl)) {
        seenUrls.add(imageUrl)
        images.push({
          url: this.resolveUrl(imageUrl),
          highResUrl: highRes ? this.resolveUrl(highRes) : undefined,
          thumbnailUrl: lowRes ? this.resolveUrl(lowRes) : undefined,
          caption: cleanText(caption),
          credit: this.createImageCredit(),
        })
      }
    }

    // 2. 從 og:image 獲取
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage && !seenUrls.has(ogImage)) {
      seenUrls.add(ogImage)
      // 嘗試獲取高解析度版本（移除尺寸後綴）
      const highResUrl = this.extractHighResImageUrl(ogImage)
      images.push({
        url: ogImage,
        highResUrl: highResUrl !== ogImage ? highResUrl : undefined,
        credit: this.createImageCredit(),
      })
    }

    // 3. 從內容區域提取其他圖片
    $('.entry-content img, .post-content img, .article-content img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      // 只提取官方 S3 或本站圖片
      if (!src.includes('s3.') && !src.includes(this.config.baseUrl)) {
        return
      }

      seenUrls.add(src)
      const alt = $(el).attr('alt') || ''
      const highResUrl = this.extractHighResImageUrl(src)

      images.push({
        url: this.resolveUrl(src),
        highResUrl: highResUrl !== src ? this.resolveUrl(highResUrl) : undefined,
        caption: cleanText(alt),
        credit: this.createImageCredit(),
      })
    })

    // 4. 從圖片廊提取
    $('.gallery-item img, .wp-block-gallery img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (!src || seenUrls.has(src)) return

      seenUrls.add(src)
      const alt = $(el).attr('alt') || ''
      const highResUrl = this.extractHighResImageUrl(src)

      images.push({
        url: this.resolveUrl(src),
        highResUrl: highResUrl !== src ? this.resolveUrl(highResUrl) : undefined,
        caption: cleanText(alt),
        credit: this.createImageCredit(),
      })
    })

    return images
  }

  /**
   * 從標題和內容中提取車款名稱
   */
  private extractModels(text: string): string[] {
    const models: string[] = []

    // Lexus 車款
    const lexusModels = [
      'ES', 'IS', 'LS', 'LC', 'RC', 'RC F',
      'UX', 'NX', 'RX', 'GX', 'TX', 'LX', 'RZ',
      'LFA', 'LF-Z',
    ]

    // Toyota 車款
    const toyotaModels = [
      'Camry', 'Corolla', 'Crown', 'Prius', 'Mirai',
      'RAV4', 'Highlander', 'Venza', 'Grand Highlander', '4Runner', 'Sequoia', 'Land Cruiser',
      'Tacoma', 'Tundra',
      'Supra', 'GR86', 'GR Corolla',
      'Sienna', 'bZ4X',
    ]

    const allModels = this.config.brand === 'Lexus' ? lexusModels : toyotaModels

    for (const model of allModels) {
      const regex = new RegExp(`\\b${model}\\b`, 'i')
      if (regex.test(text)) {
        models.push(model)
      }
    }

    return [...new Set(models)]
  }
}

/**
 * 建立 Lexus 爬蟲實例
 */
export function createLexusScraper(): LexusToyotaScraper {
  return new LexusToyotaScraper('lexus')
}

/**
 * 建立 Toyota 爬蟲實例
 */
export function createToyotaScraper(): LexusToyotaScraper {
  return new LexusToyotaScraper('toyota')
}
