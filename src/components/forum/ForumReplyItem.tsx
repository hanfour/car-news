'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { timeAgo } from '@/lib/utils/timeAgo'

interface ForumReplyItemProps {
  reply: {
    id: string
    content: string
    like_count: number
    created_at: string
    user_id: string
    author?: {
      id: string
      username?: string
      display_name?: string
      avatar_url?: string
    }
  }
}

export function ForumReplyItem({ reply }: ForumReplyItemProps) {
  const { session } = useAuth()
  const [likeCount, setLikeCount] = useState(reply.like_count)
  const [isLiked, setIsLiked] = useState(false)

  const handleLike = async () => {
    if (!session?.access_token) return

    // Optimistic update
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1)

    try {
      const res = await fetch(`/api/forum/replies/${reply.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setIsLiked(data.isLiked)
        // Reconcile with server
        setLikeCount(prev => {
          if (data.isLiked && wasLiked) return prev + 1
          if (!data.isLiked && !wasLiked) return Math.max(0, prev - 1)
          return prev
        })
      } else {
        // Revert on error
        setIsLiked(wasLiked)
        setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1))
      }
    } catch {
      // Revert on error
      setIsLiked(wasLiked)
      setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1))
    }
  }

  const profileUrl = `/user/${reply.author?.username || reply.user_id}`

  return (
    <div className="flex gap-3 py-4 border-b last:border-0 animate-slideInFromLeft" style={{ borderColor: '#e5e5e5' }}>
      <Link href={profileUrl} className="flex-shrink-0">
        <Avatar src={reply.author?.avatar_url} name={reply.author?.display_name} size={32} />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link href={profileUrl} className="text-sm font-medium hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
            {reply.author?.display_name || '匿名'}
          </Link>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {timeAgo(reply.created_at)}
          </span>
        </div>

        <MarkdownRenderer content={reply.content} />

        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleLike}
            className="flex items-center gap-1 text-xs transition-colors hover:text-[var(--brand-primary)]"
            style={{ color: isLiked ? 'var(--brand-primary)' : 'var(--text-tertiary)' }}
          >
            <svg className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {likeCount > 0 && likeCount}
          </button>
        </div>
      </div>
    </div>
  )
}
