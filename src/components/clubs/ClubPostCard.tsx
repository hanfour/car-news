'use client'

import Image from 'next/image'
import Link from 'next/link'
import { isValidImageUrl } from '@/lib/security'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

interface ClubPostCardProps {
  post: {
    id: string
    content: string
    like_count: number
    reply_count: number
    created_at: string
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

export function ClubPostCard({ post }: ClubPostCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
      {/* Author */}
      <div className="flex items-center gap-2 mb-3">
        {post.author && (
          <Link href={`/user/${post.author.username || post.author.id}`} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden">
              {post.author.avatar_url && isValidImageUrl(post.author.avatar_url) ? (
                <Image src={post.author.avatar_url} alt={post.author.display_name || '作者頭像'} width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                  <span className="text-xs font-bold">{post.author.display_name?.[0] || 'U'}</span>
                </div>
              )}
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {post.author.display_name || '匿名'}
            </span>
          </Link>
        )}
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {timeAgo(post.created_at)}
        </span>
      </div>

      {/* Content */}
      <MarkdownRenderer content={post.content} />

      {/* Stats */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs" style={{ borderColor: '#e5e5e5', color: 'var(--text-tertiary)' }}>
        <span>{post.like_count} 讚</span>
        <span>{post.reply_count} 回覆</span>
      </div>
    </div>
  )
}
