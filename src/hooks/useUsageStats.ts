'use client'

import useSWR from 'swr'
import { useAuthedFetcher } from './useAuthedFetcher'

export interface ProviderBreakdown {
  calls: number
  cost: number
}

export interface UsageWindow {
  calls: number
  cost: number
  byProvider: Record<string, ProviderBreakdown>
}

export interface UsageDayBucket {
  date: string
  byProvider: Record<string, ProviderBreakdown>
}

export interface UsageStatsResponse {
  windowDays: number
  summary: {
    today: UsageWindow
    last_7_days: UsageWindow
    last_30_days: UsageWindow
  }
  timeseries: UsageDayBucket[]
  byPurpose: Record<string, ProviderBreakdown>
  totalRows: number
}

/**
 * 取 admin dashboard 的 AI 用量聚合資料。
 * - 5 分鐘 dedupingInterval（dashboard 重訪不重打）
 * - 不 revalidateOnFocus（避免回 tab 就重打）
 */
export function useUsageStats(days: number = 30) {
  const fetcher = useAuthedFetcher()
  const { data, error, isLoading, mutate } = useSWR<UsageStatsResponse>(
    `/api/admin/usage?days=${days}`,
    fetcher as never,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60_000,
    }
  )

  return {
    data,
    isLoading,
    error,
    refresh: mutate,
  }
}
