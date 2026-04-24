'use client'

import useSWR from 'swr'
import { useAuthedFetcher } from './useAuthedFetcher'

interface Profile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  location?: string
  cover_image_url?: string
  followers_count?: number
  following_count?: number
  is_favorites_public?: boolean
}

/**
 * 取得指定使用者的 public profile（以 username 為 key）。
 * 若未傳 username 或使用者尚未載入，SWR 會 no-op 不發 request。
 */
export function useProfile(username: string | null | undefined) {
  const fetcher = useAuthedFetcher()
  const key = username ? `/api/users/${username}` : null

  const { data, error, isLoading, mutate } = useSWR<{ profile: Profile }>(
    key,
    fetcher as never,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  return {
    profile: data?.profile,
    isLoading,
    error,
    refresh: mutate,
  }
}
