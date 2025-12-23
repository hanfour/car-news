'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface AutoRefreshArticlesProps {
  /** SSR 渲染時的最新文章發布時間，用於比較是否有更新 */
  ssrLatestTime?: string | null
}

/**
 * 自動檢測新文章並刷新頁面
 * 1. 頁面載入時：比較 SSR 數據與實時數據，若有更新則自動刷新
 * 2. 頁面開啟後：使用 Supabase Realtime 監聽新文章發布
 */
export function AutoRefreshArticles({ ssrLatestTime }: AutoRefreshArticlesProps) {
  const router = useRouter()
  const [hasNewArticles, setHasNewArticles] = useState(false)
  const [latestArticleTime, setLatestArticleTime] = useState<string | null>(null)
  const initialCheckDone = useRef(false)
  const hasAutoRefreshed = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    // 獲取當前最新文章時間，並在初次載入時檢查是否需要刷新
    const fetchLatestArticleTime = async () => {
      const { data } = await supabase
        .from('generated_articles')
        .select('published_at')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        const dbLatestTime = data.published_at
        setLatestArticleTime(dbLatestTime)

        // 初次載入時，比較 SSR 數據與 DB 實時數據
        if (!initialCheckDone.current) {
          initialCheckDone.current = true

          // 如果有 SSR 時間，比較是否有更新
          if (ssrLatestTime && dbLatestTime && !hasAutoRefreshed.current) {
            const ssrTime = new Date(ssrLatestTime)
            const dbTime = new Date(dbLatestTime)

            if (dbTime > ssrTime) {
              // DB 有更新的文章，自動刷新頁面數據
              console.log('[AutoRefresh] SSR data is stale, refreshing...', {
                ssrTime: ssrTime.toISOString(),
                dbTime: dbTime.toISOString()
              })
              hasAutoRefreshed.current = true
              router.refresh()
              return
            }
          }

          // 沒有 SSR 時間時，使用 sessionStorage 作為備用
          if (!ssrLatestTime) {
            const lastSeenTime = sessionStorage.getItem('lastSeenArticleTime')
            if (lastSeenTime && dbLatestTime) {
              const lastSeen = new Date(lastSeenTime)
              const dbTime = new Date(dbLatestTime)

              if (dbTime > lastSeen && !hasAutoRefreshed.current) {
                console.log('[AutoRefresh] New articles since last visit, refreshing...')
                hasAutoRefreshed.current = true
                router.refresh()
                return
              }
            }
          }

          // 更新 sessionStorage 記錄
          if (dbLatestTime) {
            sessionStorage.setItem('lastSeenArticleTime', dbLatestTime)
          }
        }
      }
    }

    fetchLatestArticleTime()

    // 訂閱新文章發布事件
    const channel = supabase
      .channel('new-articles')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generated_articles',
          filter: 'published=eq.true'
        },
        (payload) => {
          console.log('[AutoRefresh] New article published:', payload.new)

          // 檢查是否真的有新文章（發布時間晚於當前最新）
          if (latestArticleTime) {
            const newArticleTime = new Date(payload.new.published_at as string)
            const currentLatestTime = new Date(latestArticleTime)

            if (newArticleTime > currentLatestTime) {
              setHasNewArticles(true)
              // 更新 sessionStorage
              sessionStorage.setItem('lastSeenArticleTime', payload.new.published_at as string)
            }
          } else {
            setHasNewArticles(true)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generated_articles',
          filter: 'published=eq.true'
        },
        (payload) => {
          // 如果文章從未發布變為已發布
          if (payload.old?.published === false && payload.new?.published === true) {
            console.log('[AutoRefresh] Article published:', payload.new)
            setHasNewArticles(true)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [latestArticleTime, ssrLatestTime, router])

  const handleRefresh = () => {
    setHasNewArticles(false)
    router.refresh() // 觸發 Next.js 重新獲取服務端數據
  }

  if (!hasNewArticles) return null

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 animate-slide-down">
      <button
        onClick={handleRefresh}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="font-medium">有新文章！點擊查看</span>
      </button>

      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
