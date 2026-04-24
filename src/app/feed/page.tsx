'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeed } from '@/hooks/useFeed'
import { FeedItem } from '@/components/feed/FeedItem'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'

export default function FeedPage() {
  const { session, loading: authLoading } = useAuth()
  const [page, setPage] = useState(1)
  const { items, totalPages, isLoading } = useFeed(page)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <EmptyState
          title="請先登入"
          description="登入後追蹤用戶和品牌，即可看到個人化動態牆"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>動態牆</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => (
              <FeedItem key={`${item.type}-${item.id}`} item={item} />
            ))}
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState
            title="動態牆還是空的"
            description="追蹤一些用戶或品牌，這裡就會出現他們的最新動態"
          />
        )}
      </div>
    </div>
  )
}
