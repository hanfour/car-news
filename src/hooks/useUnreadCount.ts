'use client'

import useSWR from 'swr'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthedFetcher } from './useAuthedFetcher'

/**
 * 未讀通知計數，內建 30 秒 polling。登出狀態回傳 0 且不發 request。
 *
 * 取代原本 NotificationContext 手寫的 setInterval + setState 邏輯：
 * - SWR 自動做 request dedup（多個 consumer 共用同一份 cache）
 * - revalidateOnFocus 讓切回 tab 時立刻刷新
 * - mutate 提供外部觸發 refresh 的能力（發通知後手動 invalidate）
 */
export function useUnreadCount() {
  const { session } = useAuth()
  const fetcher = useAuthedFetcher()
  const key = session?.access_token ? '/api/notifications/unread-count' : null

  const { data, mutate } = useSWR<{ count: number }>(key, fetcher as never, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  })

  return {
    unreadCount: session?.access_token ? data?.count ?? 0 : 0,
    refresh: mutate,
  }
}
