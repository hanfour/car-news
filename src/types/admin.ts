export type ArticleFilter = 'all' | 'published' | 'draft'
export type ArticleSortBy = 'date' | 'confidence'

export interface Article {
  id: string
  title_zh: string
  content_zh: string
  slug_en: string
  cover_image: string | null
  published: boolean
  published_at: string | null
  created_at: string
  confidence: number
  primary_brand: string | null
  brands: string[] | null
  categories: string[] | null
  tags: string[] | null
  image_credit: string | null
  source_urls: string[] | null
  images: Array<{ url: string; caption?: string; credit?: string; size?: number }> | null
  view_count: number
}

export interface GeneratorStats {
  lastHour: {
    count: number
    brands: { brand: string; count: number }[]
    articles: { brand: string; title_zh: string; created_at: string }[]
  }
  last24h: {
    count: number
    brands: { brand: string; count: number }[]
  }
  last3days: {
    count: number
    brands: { brand: string; count: number }[]
  }
  rawArticles: {
    count: number
    brands: { brand: string; count: number }[]
  }
  health: {
    status: 'healthy' | 'warning' | 'critical'
    teslaPercentage: number
    uniqueBrands: number
    brandsOverQuota: { brand: string; count: number }[]
  }
}

export interface DuplicateMonitorStats {
  stats: {
    totalArticles: number
    articlesWithEmbedding: number
    semanticDuplicatesCount: number
    keywordDuplicatesCount: number
    brandViolationsCount: number
    publishedArticles: number
  }
  semanticDuplicates: Array<{
    article1: { id: string; title_zh: string; brand: string | null }
    article2: { id: string; title_zh: string; brand: string | null }
    similarity: number
  }>
  keywordDuplicates: Array<{
    article1: { id: string; title_zh: string; brand: string | null }
    article2: { id: string; title_zh: string; brand: string | null }
    overlap: number
    keywords: string[]
  }>
  brandViolations: Array<{
    brand: string
    count: number
    articles: Array<{ id: string; title_zh: string; created_at: string }>
  }>
}

export interface SocialPost {
  id: string
  article_id: string
  platform: 'facebook' | 'instagram' | 'threads'
  content: string
  article_url: string
  status: 'pending' | 'posted' | 'failed'
  post_url: string | null
  error_message: string | null
  posted_at: string | null
  created_at: string
  article?: {
    id: string
    title_zh: string
    slug_en: string
    brand_tags: string[]
    created_at: string
  }
}

export interface DashboardStats {
  total: number
  published: number
  draft: number
}
