'use client'

interface CommentActionsProps {
  relativeTime: string
  isOwner: boolean
  repliesCount: number
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onReport: () => void
}

/**
 * Row of action buttons under a comment: time, reply, edit/delete (owner) or report (non-owner),
 * and the replies counter.
 */
export function CommentActions({
  relativeTime,
  isOwner,
  repliesCount,
  onReply,
  onEdit,
  onDelete,
  onReport,
}: CommentActionsProps) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span>{relativeTime}</span>
      <button
        onClick={onReply}
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
            onClick={onEdit}
            className="hover:text-blue-600 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            編輯
          </button>
          <button
            onClick={onDelete}
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
          onClick={onReport}
          className="hover:text-red-600 flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          舉報
        </button>
      )}
      {repliesCount > 0 && (
        <span className="text-gray-400">
          {repliesCount} 則回覆
        </span>
      )}
    </div>
  )
}
