/**
 * 文章相關的 TypeScript 類型定義
 */

export interface Article {
  id: string
  title_zh: string
  published_at: string | null
  view_count: number | null
  share_count: number | null
  cover_image: string | null
  categories: string[] | null
  primary_brand: string | null
  car_models: string[] | null
}

export interface ArticleWithContent extends Article {
  content_zh: string
}

export interface ArticleWithBrands extends Article {
  brands: string[] | null
}

export interface Tag {
  name: string
  count: number
}
