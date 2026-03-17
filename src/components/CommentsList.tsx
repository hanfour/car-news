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
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [sortBy, setSortBy] = useState<SortType>('time')

  const handleEdit = (id: string, newContent: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, content: newContent } : c))
  }

  const handleDelete = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
  }

  // Sort comments based on selected sort type
  const sortedComments = useMemo(() => {
    const sorted = [...comments]

    if (sortBy === 'time') {
      return sorted.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    } else {
      return sorted.sort((a, b) => {
        const likesA = a.likes_count || 0
        const likesB = b.likes_count || 0

        if (likesB !== likesA) {
          return likesB - likesA
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
  }, [comments, sortBy])

  return (
    <>
      {/* Sort Options */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
        <button
          onClick={() => setSortBy('time')}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            sortBy === 'time'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          按時間排序
        </button>
        <button
          onClick={() => setSortBy('likes')}
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
            <CommentItem
              key={comment.id}
              comment={comment}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </>
  )
}
