'use client'

import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import type { Reply } from './useCommentState'

interface ReplyListProps {
  replies: Reply[]
  getRelativeTime: (dateString: string) => string
}

/**
 * Renders the nested list of replies under a comment.
 * Pure presentational — no state or side effects.
 */
export function ReplyList({ replies, getRelativeTime }: ReplyListProps) {
  return (
    <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
      {replies.map((reply) => (
        <div key={reply.id} className="flex gap-3">
          {/* Reply avatar */}
          <div className="flex-shrink-0">
            {reply.profiles?.avatar_url && isValidImageUrl(reply.profiles.avatar_url) ? (
              <Image
                src={reply.profiles.avatar_url}
                alt={reply.profiles.display_name || '匿名用戶'}
                width={32}
                height={32}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {(reply.profiles?.display_name || 'A')[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Reply content */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {reply.profiles?.display_name || '匿名用戶'}
            </div>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
              {reply.content}
            </p>
            <div className="text-xs text-gray-500 mt-1">
              {getRelativeTime(reply.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
