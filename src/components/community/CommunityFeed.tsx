'use client'

import { useState, useEffect, useCallback } from 'react'
import { ForumPostCard } from '@/components/forum/ForumPostCard'
import { InfiniteScrollList } from '@/components/shared/InfiniteScrollList'

interface Post {
  id: string
  title: string
  content: string
  view_count: number
  reply_count: number
  like_count: number
  is_pinned: boolean
  created_at: string
  tags?: string[]
  related_brand?: string
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
  category?: { name: string; slug: string; icon?: string }
}

interface CommunityFeedProps {
  category?: string | null
  sort?: string
}

export function CommunityFeed({ category, sort = 'latest' }: CommunityFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const fetchPosts = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '15',
        sort,
      })
      if (category) params.set('category', category)

      const res = await fetch(`/api/forum/posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(prev => reset ? data.posts : [...prev, ...data.posts])
        setHasMore(pageNum < data.totalPages)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [category, sort])

  // Reset when category or sort changes
  useEffect(() => {
    setPosts([])
    setPage(1)
    setHasMore(true)
    setInitialLoading(true)
    fetchPosts(1, true)
  }, [category, sort, fetchPosts])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchPosts(nextPage)
    }
  }, [loading, hasMore, page, fetchPosts])

  if (initialLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full skeleton-light" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 skeleton-light rounded" />
                <div className="h-3 w-full skeleton-light rounded" />
                <div className="h-3 w-1/2 skeleton-light rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <InfiniteScrollList
      items={posts}
      hasMore={hasMore}
      loading={loading}
      onLoadMore={loadMore}
      keyExtractor={(post) => post.id}
      renderItem={(post) => <ForumPostCard post={post} />}
      emptyMessage="還沒有任何貼文，成為第一個發文的人吧！"
      className="space-y-3"
    />
  )
}
