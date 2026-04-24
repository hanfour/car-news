'use client'

import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthedFetcher } from './useAuthedFetcher'

interface FeedItem {
  type: string
  id: string
  created_at: string
  data: Record<string, unknown>
}

interface FeedPage {
  items: FeedItem[]
  totalPages: number
  page: number
}

/**
 * 個人化動態牆。未登入時 key 為 null，SWR 不發 request。
 */
export function useFeed(page: number) {
  const { session } = useAuth()
  const fetcher = useAuthedFetcher()
  const key = session?.access_token ? `/api/feed?page=${page}` : null

  const { data, error, isLoading, mutate } = useSWR<FeedPage>(key, fetcher as never, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })

  return {
    items: data?.items ?? [],
    totalPages: data?.totalPages ?? 0,
    isLoading,
    error,
    refresh: mutate,
  }
}
