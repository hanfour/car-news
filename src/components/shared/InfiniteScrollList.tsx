'use client'

import { useRef, useEffect, useCallback } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

interface InfiniteScrollListProps<T> {
  items: T[]
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  emptyMessage?: string
  className?: string
}

export function InfiniteScrollList<T>({
  items,
  hasMore,
  loading,
  onLoadMore,
  renderItem,
  keyExtractor,
  emptyMessage = '沒有更多內容',
  className = '',
}: InfiniteScrollListProps<T>) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        onLoadMore()
      }
    },
    [onLoadMore, hasMore, loading]
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
    })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleIntersect])

  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={keyExtractor(item)}>{renderItem(item, index)}</div>
      ))}

      {/* Sentinel for intersection observer */}
      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="flex items-center justify-center py-6">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="text-center py-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          已顯示所有內容
        </div>
      )}
    </div>
  )
}
