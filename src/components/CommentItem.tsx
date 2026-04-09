'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ToastContainer'
import { AuthModal } from './AuthModal'
import { ReportModal } from './ReportModal'

interface CommentItemProps {
  comment: {
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
  onEdit?: (id: string, newContent: string) => void
  onDelete?: (id: string) => void
}

interface Reply {
  id: string
  content: string
  created_at: string
  user_id: string
  likes_count: number
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
}

export function CommentItem({ comment, onEdit, onDelete }: CommentItemProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [isLiked, setIsLiked] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const isOwner = user?.id === comment.user_id
  const [likeCount, setLikeCount] = useState(comment.likes_count || 0)
  const [isLiking, setIsLiking] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [replies, setReplies] = useState<Reply[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [isLoadingReplies, setIsLoadingReplies] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  const authorName = comment.profiles?.display_name || '匿名用戶'
  const avatarUrl = comment.profiles?.avatar_url

  // Fetch initial like status and count (always, even for anonymous users)
  useEffect(() => {
    const fetchLikeStatus = async () => {
      try {
        // Get session if user is logged in
        let token = null
        if (user) {
          const { createClient } = await import('@/lib/supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token
        }

        // Fetch like status (with or without auth)
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`/api/comments/${comment.id}/like`, {
          headers
        })

        if (response.ok) {
          const data = await response.json()
          setIsLiked(data.isLiked)
          setLikeCount(data.likeCount)
        }
      } catch (error) {
        console.error('Failed to fetch like status:', error)
      }
    }

    fetchLikeStatus()
  }, [comment.id, user])

  // Auto-load replies on mount if they exist
  useEffect(() => {
    const loadInitialReplies = async () => {
      try {
        const response = await fetch(`/api/comments/${comment.id}/replies`)

        if (response.ok) {
          const data = await response.json()
          if (data.replies && data.replies.length > 0) {
            setReplies(data.replies)
            setShowReplies(true)
          }
        }
      } catch (error) {
        console.error('Failed to load initial replies:', error)
      }
    }

    loadInitialReplies()
  }, [comment.id])

  // Calculate relative time
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

  // Handle like/unlike
  const handleLike = async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    if (isLiking) return

    setIsLiking(true)

    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setShowLoginModal(true)
        setIsLiking(false)
        return
      }

      const response = await fetch(`/api/comments/${comment.id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIsLiked(data.isLiked)
        setLikeCount(data.likeCount)
      } else {
        const error = await response.json()
        console.error('Like failed:', error)
      }
    } catch (error) {
      console.error('Failed to toggle like:', error)
    } finally {
      setIsLiking(false)
    }
  }

  // Load replies
  const loadReplies = async () => {
    setIsLoadingReplies(true)

    try {
      const response = await fetch(`/api/comments/${comment.id}/replies`)

      if (response.ok) {
        const data = await response.json()
        setReplies(data.replies || [])
        setShowReplies(true)
      }
    } catch (error) {
      console.error('Failed to load replies:', error)
    } finally {
      setIsLoadingReplies(false)
    }
  }

  // Handle reply button click
  const handleReply = () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    setShowReplyForm(!showReplyForm)

    // Load replies if not already loaded
    if (!showReplies && !showReplyForm) {
      loadReplies()
    }
  }

  // Submit reply
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      setShowLoginModal(true)
      return
    }

    if (!replyContent.trim()) {
      setReplyError('請輸入回覆內容')
      return
    }

    if (replyContent.length > 1000) {
      setReplyError('回覆不能超過 1000 個字元')
      return
    }

    setIsSubmittingReply(true)
    setReplyError('')

    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setShowLoginModal(true)
        setIsSubmittingReply(false)
        return
      }

      const response = await fetch(`/api/comments/${comment.id}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          content: replyContent.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()

        // Add new reply to the list
        setReplies([...replies, data.reply])
        setShowReplies(true)
        setReplyContent('')
        setShowReplyForm(false)
      } else {
        const error = await response.json()
        setReplyError(error.error || '回覆失敗，請稍後再試')
      }
    } catch (error) {
      console.error('Failed to submit reply:', error)
      setReplyError('網絡錯誤，請檢查您的連接')
    } finally {
      setIsSubmittingReply(false)
    }
  }

  // Handle edit save
  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSavingEdit) return
    setIsSavingEdit(true)
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      })

      if (response.ok) {
        onEdit?.(comment.id, editContent.trim())
        setIsEditing(false)
        showToast('評論已更新', 'success')
      } else {
        const data = await response.json()
        showToast(data.error || '編輯失敗', 'error')
      }
    } catch (error) {
      console.error('[CommentItem] Edit failed:', error)
      showToast('編輯失敗', 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!confirm('確定要刪除這則評論嗎？')) return
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/comments/${comment.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        onDelete?.(comment.id)
        showToast('評論已刪除', 'success')
      } else {
        const data = await response.json()
        showToast(data.error || '刪除失敗', 'error')
      }
    } catch (error) {
      console.error('[CommentItem] Delete failed:', error)
      showToast('刪除失敗', 'error')
    }
  }

  // Handle report
  const handleReport = () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    setShowReportModal(true)
  }

  const handleSubmitReport = async (reason: string, description: string) => {
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setShowLoginModal(true)
        throw new Error('未登入')
      }

      const response = await fetch(`/api/comments/${comment.id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason, description })
      })

      const data = await response.json()

      if (response.ok) {
        showToast(data.message || '檢舉已提交，我們會盡快處理。', 'success')
      } else {
        showToast(data.error || '檢舉失敗，請稍後再試。', 'error')
      }
    } catch (error) {
      console.error('Failed to report comment:', error)
      showToast('檢舉失敗，請稍後再試。', 'error')
      throw error
    }
  }

  return (
    <>
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

          {isEditing ? (
            <div className="mb-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                disabled={isSavingEdit}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">{editContent.length}/2000</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsEditing(false); setEditContent(comment.content) }}
                    className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
                    disabled={isSavingEdit}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editContent.trim()}
                    className="px-3 py-1 text-xs text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isSavingEdit ? '儲存中...' : '儲存'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 mb-2 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

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
            {isOwner && (
              <>
                <button
                  onClick={() => { setIsEditing(true); setEditContent(comment.content) }}
                  className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  編輯
                </button>
                <button
                  onClick={handleDelete}
                  className="hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  刪除
                </button>
              </>
            )}
            {!isOwner && (
              <button
                onClick={handleReport}
                className="hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                舉報
              </button>
            )}
            {replies.length > 0 && (
              <span className="text-gray-400">
                {replies.length} 則回覆
              </span>
            )}
          </div>

          {/* 回覆表單 */}
          {showReplyForm && (
            <form onSubmit={handleSubmitReply} className="mt-3 p-3 bg-gray-50 rounded-lg">
              {replyError && (
                <div className="mb-2 text-xs text-red-600">{replyError}</div>
              )}
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                placeholder="寫下你的回覆..."
                disabled={isSubmittingReply}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{replyContent.length}/1000</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyForm(false)
                      setReplyContent('')
                      setReplyError('')
                    }}
                    className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
                    disabled={isSubmittingReply}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReply || !replyContent.trim()}
                    className="px-3 py-1 text-xs text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isSubmittingReply ? '提交中...' : '提交'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 回覆列表 */}
          {showReplies && replies.length > 0 && (
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
                        unoptimized
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
          )}
        </div>

        {/* 點贊 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`hover:bg-gray-100 p-1.5 rounded transition-colors disabled:cursor-not-allowed ${
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

      {/* Login Modal */}
      <AuthModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSubmitReport}
        type="comment"
        title={comment.content.slice(0, 100)}
      />
    </>
  )
}
