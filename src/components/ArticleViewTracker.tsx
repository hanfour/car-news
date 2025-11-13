'use client'

import { useEffect, useRef } from 'react'

interface ArticleViewTrackerProps {
  articleId: string
}

/**
 * Client-side view count tracker
 * Sends view count increment after 3 seconds of viewing
 * Prevents bots and accidental clicks from inflating counts
 */
export function ArticleViewTracker({ articleId }: ArticleViewTrackerProps) {
  const hasTracked = useRef(false)

  useEffect(() => {
    // Only track once per page load
    if (hasTracked.current) return

    // Wait 3 seconds to ensure user is actually reading
    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/articles/${articleId}/view`, {
          method: 'POST',
        })
        hasTracked.current = true
      } catch (error) {
        // Silently fail - view counting is not critical
        console.error('Failed to track view:', error)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [articleId])

  // This component renders nothing
  return null
}
