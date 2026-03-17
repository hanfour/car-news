'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { ThreadedReplies } from '@/components/forum/ThreadedReplies'
import { ForumReplyForm } from '@/components/forum/ForumReplyForm'
import { PostActionBar } from '@/components/forum/PostActionBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'
import { timeAgo } from '@/lib/utils/timeAgo'

interface Post {
  id: string
  title: string
  content: string
  view_count: number
  reply_count: number
  like_count: number
  bookmark_count?: number
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
  parent_id?: string | null
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
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
    } catch (err) { console.error('[PostDetailPage] fetchPost:', err) } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPost() }, [postId])

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
    } catch (err) { console.error('[PostDetailPage] toggleLike:', err) }
  }

  if (loading) return <LoadingCenter size="lg" />

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState title="找不到此貼文" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Link href="/community" className="hover:text-[var(--brand-primary)] transition-colors">
          社群
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
              <Avatar src={post.author.avatar_url} name={post.author.display_name} size={40} />
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
        {(post.related_brand || (post.tags && post.tags.length > 0)) && (
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
        )}

        {/* Action Bar */}
        <PostActionBar
          postId={postId}
          likeCount={likeCount}
          replyCount={post.reply_count}
          isLiked={isLiked}
          onLike={handleLikePost}
        />
      </article>

      {/* Replies */}
      <div className="mt-6">
        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          回覆 ({replies.length})
        </h2>

        <ThreadedReplies
          replies={replies}
          postId={postId}
          onReplyCreated={fetchPost}
        />

        {/* Reply Form */}
        {!post.is_locked ? (
          <div className="mt-6">
            <ForumReplyForm postId={postId} onReplyCreated={fetchPost} />
          </div>
        ) : (
          <div className="mt-4 text-center text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>
            此貼文已鎖定，無法回覆
          </div>
        )}
      </div>
    </div>
  )
}
