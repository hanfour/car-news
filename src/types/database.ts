export interface RawArticle {
  id: string
  url: string
  title: string
  content: string
  scraped_at: string
  expires_at: string
  embedding: number[]
}

export interface GeneratedArticle {
  id: string
  cluster_id?: string
  title_zh: string
  content_zh: string
  slug_en: string
  source_urls: string[]
  confidence: number
  quality_checks: QualityChecks
  reasoning?: string
  style_version: string
  published: boolean
  published_at?: string
  created_at: string
  view_count: number
  share_count: number
}

export interface QualityChecks {
  has_data: boolean
  has_sources: boolean
  has_banned_words: boolean
  has_unverified: boolean
  structure_valid: boolean
}

export interface Comment {
  id: string
  article_id: string
  author_name: string
  content: string
  ai_moderation: {
    passed: boolean
    confidence: number
    flags: string[]
  }
  visible: boolean
  created_at: string
}

export interface DailyTopicLock {
  date: string
  topic_hash: string
  article_id: string
  created_at: string
}

export interface ArticleCluster {
  articles: RawArticle[]
  centroid: number[]
  similarity: number
}

export interface NewsSource {
  id: string
  name: string
  url: string
  type: 'rss' | 'scrape'
  selector?: {
    article: string
    title: string
    content: string
    link: string
  }
}
