/**
 * 官方 Pressroom 爬蟲型別定義
 */

/**
 * 官方新聞稿圖片
 */
export interface PressroomImage {
  url: string
  highResUrl?: string      // 高解析度版本
  thumbnailUrl?: string    // 縮圖版本
  width?: number
  height?: number
  caption?: string         // 圖片說明
  credit: string           // 來源標註，如 "Lexus Official"
}

/**
 * 官方新聞稿文章
 */
export interface PressroomArticle {
  // 來源資訊
  source: string           // 域名，如 'pressroom.lexus.com'
  sourceType: 'official'   // 固定為 official
  brand: string            // 品牌名，如 'Lexus'

  // 文章內容
  url: string              // 原始文章 URL
  title: string            // 標題（通常為英文）
  summary?: string         // 摘要
  content: string          // 完整內容
  publishedAt: Date        // 發布時間

  // 圖片資源
  images: PressroomImage[]
  featuredImage?: PressroomImage  // 主圖

  // 分類標籤
  category?: string        // 'Product', 'Corporate', 'Motorsport'
  tags?: string[]          // ['RZ', 'Electric', 'F Sport']
  models?: string[]        // 相關車款，如 ['RZ 600e', 'RZ 450e']
}

/**
 * 爬蟲配置
 */
export interface PressroomScraperConfig {
  brand: string
  baseUrl: string
  newsListUrl: string
  // 請求設定
  userAgent?: string
  requestDelay?: number    // 請求間隔（毫秒）
  maxArticles?: number     // 單次最多爬取數量
  // 時間範圍
  maxAgeDays?: number      // 最多爬取多少天前的文章
}

/**
 * 爬蟲結果
 */
export interface ScraperResult {
  success: boolean
  articles: PressroomArticle[]
  errors: string[]
  stats: {
    total: number
    new: number
    skipped: number
    failed: number
  }
}

/**
 * 品牌 Pressroom 配置
 */
export const PRESSROOM_CONFIGS: Record<string, PressroomScraperConfig> = {
  lexus: {
    brand: 'Lexus',
    baseUrl: 'https://pressroom.lexus.com',
    newsListUrl: 'https://pressroom.lexus.com/releases',
    maxArticles: 20,
    maxAgeDays: 7,
    requestDelay: 1000,
  },
  toyota: {
    brand: 'Toyota',
    baseUrl: 'https://pressroom.toyota.com',
    newsListUrl: 'https://pressroom.toyota.com/releases',
    maxArticles: 20,
    maxAgeDays: 7,
    requestDelay: 1000,
  },
  bmw: {
    brand: 'BMW',
    baseUrl: 'https://www.press.bmwgroup.com',
    newsListUrl: 'https://www.press.bmwgroup.com/global/article/list',
    maxArticles: 20,
    maxAgeDays: 7,
    requestDelay: 1000,
  },
  porsche: {
    brand: 'Porsche',
    baseUrl: 'https://newsroom.porsche.com',
    newsListUrl: 'https://newsroom.porsche.com/en/press-releases.html',
    maxArticles: 20,
    maxAgeDays: 7,
    requestDelay: 1000,
  },
  volkswagen: {
    brand: 'Volkswagen',
    baseUrl: 'https://www.volkswagen-newsroom.com',
    newsListUrl: 'https://www.volkswagen-newsroom.com/en/press-releases',
    maxArticles: 20,
    maxAgeDays: 7,
    requestDelay: 1000,
  },
  kia: {
    brand: 'Kia',
    baseUrl: 'https://www.kiamedia.com',
    newsListUrl: 'https://www.kiamedia.com/us/en/media/pressreleases',
    maxArticles: 20,
    maxAgeDays: 7,
    requestDelay: 1000,
  },
}

/**
 * 支援的品牌列表
 */
export const SUPPORTED_PRESSROOM_BRANDS = Object.keys(PRESSROOM_CONFIGS)
