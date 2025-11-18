'use client'

import { useState, useMemo } from 'react'
import { CommentItem } from './CommentItem'

type SortType = 'time' | 'likes'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  likes_count?: number
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
}

interface CommentsListProps {
  initialComments: Comment[]
}

export function CommentsList({ initialComments }: CommentsListProps) {
  const [sortBy, setSortBy] = useState<SortType>('time')

  // Sort comments based on selected sort type
  const sortedComments = useMemo(() => {
    const comments = [...initialComments]

    console.log('[CommentsList] Sorting by:', sortBy)
    console.log('[CommentsList] Original comments:', comments.map(c => ({
      id: c.id.slice(0, 8),
      likes: c.likes_count || 0,
      content: c.content.slice(0, 20)
    })))

    if (sortBy === 'time') {
      // Sort by created_at descending (newest first)
      const sorted = comments.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      console.log('[CommentsList] Sorted by time:', sorted.map(c => ({
        id: c.id.slice(0, 8),
        time: c.created_at
      })))
      return sorted
    } else {
      // Sort by likes_count descending (most liked first), then by time
      const sorted = comments.sort((a, b) => {
        const likesA = a.likes_count || 0
        const likesB = b.likes_count || 0

        if (likesB !== likesA) {
          return likesB - likesA
        }

        // If same likes, sort by time (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      console.log('[CommentsList] Sorted by likes:', sorted.map(c => ({
        id: c.id.slice(0, 8),
        likes: c.likes_count || 0
      })))
      return sorted
    }
  }, [initialComments, sortBy])

  return (
    <>
      {/* Sort Options */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
        <button
          onClick={() => {
            console.log('[CommentsList] Button clicked: time, current sortBy:', sortBy)
            setSortBy('time')
          }}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            sortBy === 'time'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          按時間排序
        </button>
        <button
          onClick={() => {
            console.log('[CommentsList] Button clicked: likes, current sortBy:', sortBy)
            setSortBy('likes')
          }}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            sortBy === 'likes'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          按點讚排序
        </button>
      </div>

      {/* Comments List */}
      <div className="space-y-6">
        {sortedComments.length === 0 ? (
          <p className="text-center text-gray-500 py-8">尚無評論，成為第一個留言的人吧！</p>
        ) : (
          sortedComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </>
  )
}
