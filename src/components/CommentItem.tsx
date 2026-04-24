'use client'

import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ToastContainer'
import { AuthModal } from './AuthModal'
import { ReportModal } from './ReportModal'
import { useCommentState } from './comments/useCommentState'
import { CommentEditForm, ReplyForm } from './comments/CommentEditor'
import { CommentActions } from './comments/CommentActions'
import { ReplyList } from './comments/ReplyList'

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

// Calculate relative time
function getRelativeTime(dateString: string) {
  const now = new Date()
  const commentDate = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000)

  if (diffInSeconds < 60) return '剛剛'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分鐘前`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小時前`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} 天前`
  return `${Math.floor(diffInSeconds / 2592000)} 個月前`
}

export function CommentItem({ comment, onEdit, onDelete }: CommentItemProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isOwner = user?.id === comment.user_id

  const state = useCommentState({
    commentId: comment.id,
    initialContent: comment.content,
    initialLikesCount: comment.likes_count,
    user,
    onEdit,
    onDelete,
    showToast,
  })

  const authorName = comment.profiles?.display_name || '匿名用戶'
  const avatarUrl = comment.profiles?.avatar_url

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

          {state.isEditing ? (
            <CommentEditForm
              value={state.editContent}
              onChange={state.setEditContent}
              onCancel={state.cancelEdit}
              onSave={state.handleSaveEdit}
              isSaving={state.isSavingEdit}
            />
          ) : (
            <p className="text-gray-700 mb-2 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* 操作列 */}
          <CommentActions
            relativeTime={getRelativeTime(comment.created_at)}
            isOwner={isOwner}
            repliesCount={state.replies.length}
            onReply={state.handleReply}
            onEdit={state.startEdit}
            onDelete={state.handleDelete}
            onReport={state.handleReport}
          />

          {/* 回覆表單 */}
          {state.showReplyForm && (
            <ReplyForm
              value={state.replyContent}
              onChange={state.setReplyContent}
              onCancel={state.cancelReply}
              onSubmit={state.handleSubmitReply}
              isSubmitting={state.isSubmittingReply}
              error={state.replyError}
            />
          )}

          {/* 回覆列表 */}
          {state.showReplies && state.replies.length > 0 && (
            <ReplyList replies={state.replies} getRelativeTime={getRelativeTime} />
          )}
        </div>

        {/* 點贊 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <button
            onClick={state.handleLike}
            disabled={state.isLiking}
            className={`hover:bg-gray-100 p-1.5 rounded transition-colors disabled:cursor-not-allowed ${
              state.isLiked ? 'bg-orange-50' : ''
            }`}
          >
            <svg
              className={`w-5 h-5 ${
                state.isLiked ? 'text-orange-500 fill-current' : 'text-gray-400'
              }`}
              fill={state.isLiked ? 'currentColor' : 'none'}
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
            {state.likeCount > 0 ? `${state.likeCount}人` : '按讚'}
          </span>
        </div>
      </div>

      {/* Login Modal */}
      <AuthModal isOpen={state.showLoginModal} onClose={() => state.setShowLoginModal(false)} />

      {/* Report Modal */}
      <ReportModal
        isOpen={state.showReportModal}
        onClose={() => state.setShowReportModal(false)}
        onSubmit={state.handleSubmitReport}
        type="comment"
        title={comment.content.slice(0, 100)}
      />
    </>
  )
}
