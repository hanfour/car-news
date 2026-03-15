'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { useAuth } from '@/contexts/AuthContext'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { ForumReplyItem } from '@/components/forum/ForumReplyItem'
import { ForumReplyForm } from '@/components/forum/ForumReplyForm'
import { EmptyState } from '@/components/shared/EmptyState'

interface Post {
  id: string
  title: string
  content: string
  view_count: number
  reply_count: number
  like_count: number
  is_pinned: boolean
  is_locked: boolean
  created_at: string
  tags?: string[]
  related_brand?: string
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
  category?: { id: string; name: string; slug: string; icon?: string }
}

interface Reply {
  id: string
  content: string
  like_count: number
  created_at: string
  user_id: string
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-TW')
}

export default function PostDetailPage() {
  const params = useParams()
  const postId = params.id as string
  const { session } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}`)
      if (res.ok) {
        const data = await res.json()
        setPost(data.post)
        setReplies(data.replies)
        setLikeCount(data.post.like_count)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPost()
  }, [postId])

  const handleLikePost = async () => {
    if (!session?.access_token) return

    try {
      const res = await fetch(`/api/forum/posts/${postId}/like`, {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState title="找不到此貼文" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Link href="/community" className="hover:text-[var(--brand-primary)] transition-colors">
          討論區
        </Link>
        {post.category && (
          <>
            <span>/</span>
            <Link href={`/community/${post.category.slug}`} className="hover:text-[var(--brand-primary)] transition-colors">
              {post.category.icon} {post.category.name}
            </Link>
          </>
        )}
      </div>

      {/* Post */}
      <article className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        {/* Title */}
        <div className="flex items-start gap-2 mb-4">
          {post.is_pinned && (
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--brand-primary-lighter)] font-medium flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
              置頂
            </span>
          )}
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {post.title}
          </h1>
        </div>

        {/* Author info */}
        {post.author && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: '#e5e5e5' }}>
            <Link href={`/user/${post.author.username || post.author.id}`}>
              <div className="w-10 h-10 rounded-full overflow-hidden">
                {post.author.avatar_url && isValidImageUrl(post.author.avatar_url) ? (
                  <Image src={post.author.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                    <span className="text-sm font-bold">{post.author.display_name?.[0] || 'U'}</span>
                  </div>
                )}
              </div>
            </Link>
            <div>
              <Link href={`/user/${post.author.username || post.author.id}`} className="text-sm font-medium hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                {post.author.display_name || '匿名'}
              </Link>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span>{timeAgo(post.created_at)}</span>
                <span>{post.view_count} 瀏覽</span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mb-4">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* Tags and Brand */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {post.related_brand && (
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--brand-primary-lighter)]" style={{ color: 'var(--text-primary)' }}>
              {post.related_brand}
            </span>
          )}
          {post.tags?.map(tag => (
            <span key={tag} className="text-xs px-2 py-1 rounded-full bg-gray-100" style={{ color: 'var(--text-secondary)' }}>
              #{tag}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-4 border-t" style={{ borderColor: '#e5e5e5' }}>
          <button
            onClick={handleLikePost}
            className="flex items-center gap-1 text-sm transition-colors hover:text-[var(--brand-primary)]"
            style={{ color: isLiked ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {likeCount > 0 && likeCount}
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {post.reply_count} 回覆
          </span>
        </div>
      </article>

      {/* Replies */}
      <div className="mt-6">
        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          回覆 ({replies.length})
        </h2>

        {replies.length > 0 && (
          <div className="bg-white rounded-xl border px-4" style={{ borderColor: 'var(--border-color)' }}>
            {replies.map(reply => (
              <ForumReplyItem key={reply.id} reply={reply} />
            ))}
          </div>
        )}

        {/* Reply Form */}
        {!post.is_locked && (
          <div className="mt-6">
            <ForumReplyForm postId={postId} onReplyCreated={fetchPost} />
          </div>
        )}

        {post.is_locked && (
          <div className="mt-4 text-center text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>
            此貼文已鎖定，無法回覆
          </div>
        )}
      </div>
    </div>
  )
}
