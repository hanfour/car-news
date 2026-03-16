'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { ForumReplyForm } from '@/components/forum/ForumReplyForm'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils/timeAgo'

interface Reply {
  id: string
  content: string
  like_count: number
  created_at: string
  user_id: string
  parent_id?: string | null
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

interface ReplyNode extends Reply {
  children: ReplyNode[]
}

interface ThreadedRepliesProps {
  replies: Reply[]
  postId: string
  onReplyCreated: () => void
  maxDepth?: number
}

function buildTree(replies: Reply[]): ReplyNode[] {
  const map = new Map<string, ReplyNode>()
  const roots: ReplyNode[] = []

  // Create nodes
  for (const reply of replies) {
    map.set(reply.id, { ...reply, children: [] })
  }

  // Build tree
  for (const reply of replies) {
    const node = map.get(reply.id)!
    if (reply.parent_id && map.has(reply.parent_id)) {
      map.get(reply.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function ReplyItem({
  reply,
  depth,
  maxDepth,
  postId,
  onReplyCreated,
}: {
  reply: ReplyNode
  depth: number
  maxDepth: number
  postId: string
  onReplyCreated: () => void
}) {
  const { session } = useAuth()
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(reply.like_count)
  const [collapsed, setCollapsed] = useState(false)

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
    } catch { /* */ }
  }

  const profileUrl = `/user/${reply.author?.username || reply.user_id}`

  return (
    <div className={depth > 0 ? 'ml-6 pl-4 border-l-2' : ''} style={depth > 0 ? { borderColor: '#e5e5e5' } : undefined}>
      <div className="py-3">
        <div className="flex gap-3">
          <Link href={profileUrl} className="flex-shrink-0">
            <Avatar src={reply.author?.avatar_url} name={reply.author?.display_name} size={depth === 0 ? 32 : 28} />
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

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleLike}
                className="flex items-center gap-1 text-xs transition-colors hover:text-[var(--brand-primary)]"
                style={{ color: isLiked ? 'var(--brand-primary)' : 'var(--text-tertiary)' }}
              >
                <svg className="w-3.5 h-3.5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                {likeCount > 0 && likeCount}
              </button>

              {depth < maxDepth && session && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-xs transition-colors hover:text-[var(--brand-primary)]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  回覆
                </button>
              )}

              {reply.children.length > 0 && (
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="text-xs transition-colors hover:text-[var(--brand-primary)]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {collapsed ? `展開 ${reply.children.length} 則回覆` : '收合'}
                </button>
              )}
            </div>

            {/* Inline reply form */}
            {showReplyForm && (
              <div className="mt-3">
                <ForumReplyForm
                  postId={postId}
                  parentId={reply.id}
                  onReplyCreated={() => {
                    setShowReplyForm(false)
                    onReplyCreated()
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {!collapsed && reply.children.length > 0 && (
        <div>
          {reply.children.map(child => (
            <ReplyItem
              key={child.id}
              reply={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              postId={postId}
              onReplyCreated={onReplyCreated}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ThreadedReplies({ replies, postId, onReplyCreated, maxDepth = 3 }: ThreadedRepliesProps) {
  const tree = buildTree(replies)

  if (tree.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
      <div className="px-4">
        {tree.map(reply => (
          <div key={reply.id} className="border-b last:border-0" style={{ borderColor: '#e5e5e5' }}>
            <ReplyItem
              reply={reply}
              depth={0}
              maxDepth={maxDepth}
              postId={postId}
              onReplyCreated={onReplyCreated}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
