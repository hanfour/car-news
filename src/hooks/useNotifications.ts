'use client'

import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthedFetcher } from './useAuthedFetcher'

interface Notification {
  id: string
  type: string
  body?: string
  is_read: boolean
  created_at: string
  resource_type?: string
  resource_id?: string
  metadata: Record<string, string>
  actor?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface NotificationsResponse {
  notifications: Notification[]
  totalPages: number
  page: number
}

/**
 * 分頁通知列表。SWR 處理 polling / dedup / focus revalidate；
 * 操作（如 mark-all-read）完成後用回傳的 `refresh` / `mutate` 觸發 invalidation。
 */
export function useNotificationsList(page: number, limit = 20) {
  const { session } = useAuth()
  const fetcher = useAuthedFetcher()
  const key = session?.access_token
    ? `/api/notifications?page=${page}&limit=${limit}`
    : null

  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    key,
    fetcher as never,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  )

  return {
    notifications: data?.notifications ?? [],
    totalPages: data?.totalPages ?? 0,
    isLoading,
    error,
    /** 重新抓取（可傳 optimistic data） */
    refresh: mutate,
  }
}
