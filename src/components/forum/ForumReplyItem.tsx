'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { isValidImageUrl } from '@/lib/security'
import { useAuth } from '@/contexts/AuthContext'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

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

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes}分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-TW')
}

export function ForumReplyItem({ reply }: ForumReplyItemProps) {
  const { session } = useAuth()
  const [likeCount, setLikeCount] = useState(reply.like_count)
  const [isLiked, setIsLiked] = useState(false)

  const handleLike = async () => {
    if (!session?.access_token) return

    try {
      const res = await fetch(`/api/forum/replies/${reply.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setIsLiked(data.isLiked)
        setLikeCount(prev => data.isLiked ? prev + 1 : Math.max(0, prev - 1))
      }
    } catch {
      // Silently fail
    }
  }

  const profileUrl = `/user/${reply.author?.username || reply.user_id}`

  return (
    <div className="flex gap-3 py-4 border-b last:border-0" style={{ borderColor: '#e5e5e5' }}>
      <Link href={profileUrl} className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden">
          {reply.author?.avatar_url && isValidImageUrl(reply.author.avatar_url) ? (
            <Image src={reply.author.avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
          ) : (
            <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
              <span className="text-xs font-bold">{reply.author?.display_name?.[0] || 'U'}</span>
            </div>
          )}
        </div>
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
