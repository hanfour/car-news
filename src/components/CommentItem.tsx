'use client'

import { useState } from 'react'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface CommentItemProps {
  comment: {
    id: string
    content: string
    created_at: string
    user_id: string
    profiles: {
      display_name: string
      avatar_url: string | null
    } | null
  }
}

export function CommentItem({ comment }: CommentItemProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(5) // TODO: 從資料庫讀取實際數據
  const [showReplyForm, setShowReplyForm] = useState(false)

  const authorName = comment.profiles?.display_name || '匿名用戶'
  const avatarUrl = comment.profiles?.avatar_url

  // 計算相對時間
  const getRelativeTime = (dateString: string) => {
    const now = new Date()
    const commentDate = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000)

    if (diffInSeconds < 60) return '剛剛'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分鐘前`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小時前`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} 天前`
    return `${Math.floor(diffInSeconds / 2592000)} 個月前`
  }

  const handleLike = () => {
    // TODO: 調用 API 記錄按讚
    setIsLiked(!isLiked)
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
  }

  const handleReply = () => {
    // TODO: 實現回覆功能
    setShowReplyForm(!showReplyForm)
    console.log('Reply to comment:', comment.id)
  }

  const handleReport = () => {
    // TODO: 實現舉報功能
    if (confirm('確定要舉報這則評論嗎？')) {
      console.log('Report comment:', comment.id)
      alert('感謝您的舉報，我們會盡快審核')
    }
  }

  return (
    <div className="flex gap-4">
      {/* 頭像 */}
      <div className="flex-shrink-0">
        {avatarUrl && isValidImageUrl(avatarUrl) ? (
          <Image
            src={avatarUrl}
            alt={authorName}
            width={40}
            height={40}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {authorName[0]?.toUpperCase() || 'A'}
            </span>
          </div>
        )}
      </div>

      {/* 內容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900">{authorName}</span>
        </div>

        <p className="text-gray-700 mb-2 whitespace-pre-wrap break-words">
          {comment.content}
        </p>

        {/* 操作列 */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{getRelativeTime(comment.created_at)}</span>
          <button
            onClick={handleReply}
            className="hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            回覆
          </button>
          <button
            onClick={handleReport}
            className="hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            舉報
          </button>
        </div>

        {/* 回覆表單 (暫時隱藏) */}
        {showReplyForm && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">回覆功能即將開放</p>
            <button
              onClick={() => setShowReplyForm(false)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 點贊 */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <button
          onClick={handleLike}
          className={`hover:bg-gray-100 p-1.5 rounded transition-colors ${
            isLiked ? 'bg-orange-50' : ''
          }`}
        >
          <svg
            className={`w-5 h-5 ${
              isLiked ? 'text-orange-500 fill-current' : 'text-gray-400'
            }`}
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
        </button>
        <span className="text-xs text-gray-500">
          {likeCount > 0 ? `${likeCount}人` : '按讚'}
        </span>
      </div>
    </div>
  )
}
