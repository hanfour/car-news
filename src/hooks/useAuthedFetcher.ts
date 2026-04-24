'use client'

import { useAuth } from '@/contexts/AuthContext'

/**
 * SWR fetcher 產生器：若 session 存在則自動掛 Authorization header；無 session 直接 fetch。
 *
 * 用法：
 *   const fetcher = useAuthedFetcher()
 *   const { data } = useSWR('/api/feed', fetcher)
 *
 * 回傳的 fetcher 同一個 hook 實例穩定（會跟著 session token 變化）。
 */
export function useAuthedFetcher() {
  const { session } = useAuth()
  const token = session?.access_token

  return async (url: string): Promise<unknown> => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`) as Error & {
        status?: number
        info?: unknown
      }
      err.status = res.status
      try {
        err.info = await res.json()
      } catch {
        err.info = null
      }
      throw err
    }
    return res.json()
  }
}
