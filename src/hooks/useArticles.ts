'use client'

import useSWR from 'swr'
import { useAuthedFetcher } from './useAuthedFetcher'

interface ArticleSummary {
  id: string
  title_zh: string
  published_at: string
  cover_image: string | null
  primary_brand: string | null
  categories: string[]
  view_count: number | null
}

interface ArticlesPage {
  articles: ArticleSummary[]
  total?: number
  has_more?: boolean
}

/**
 * 取得文章列表（含分頁 / 類別 / 品牌過濾）。
 * Key 以「完整 URL」為主，SWR 會自動做 dedup 與 revalidation。
 */
export function useArticles(params: {
  page?: number
  limit?: number
  category?: string
  brand?: string
} = {}) {
  const fetcher = useAuthedFetcher()

  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.limit) search.set('limit', String(params.limit))
  if (params.category) search.set('category', params.category)
  if (params.brand) search.set('brand', params.brand)
  const qs = search.toString()
  const key = qs ? `/api/articles?${qs}` : '/api/articles'

  const { data, error, isLoading, mutate } = useSWR<ArticlesPage>(key, fetcher as never, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  return {
    articles: data?.articles ?? [],
    total: data?.total,
    hasMore: data?.has_more,
    isLoading,
    error,
    refresh: mutate,
  }
}
