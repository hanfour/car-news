'use client'

import useSWR from 'swr'
import { useAuthedFetcher } from './useAuthedFetcher'

export interface ClubMember {
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: string
  joined_at: string
  profile?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface MembersResponse {
  members: ClubMember[]
}

/**
 * 社團成員列表，搭配 SWR cache 共用 + revalidateOnFocus 自動同步。
 *
 * 原本 ClubMemberList 自己手刻 useState + useEffect + fetchMembers，
 * 三個 mutation handler 各自呼叫 fetchMembers() 刷新；改成本 hook 後
 * mutation 只需 await mutate()，且多個 consumer 共用同一份 cache。
 *
 * @param slug 社團 slug
 * @returns members、isLoading、mutate（給 mutation handler 主動刷新用）
 */
export function useClubMembers(slug: string) {
  const fetcher = useAuthedFetcher()
  const { data, error, isLoading, mutate } = useSWR<MembersResponse>(
    slug ? `/api/clubs/${slug}/members` : null,
    fetcher as never
  )

  return {
    members: data?.members ?? [],
    isLoading,
    error,
    mutate,
  }
}
