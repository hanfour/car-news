'use client'

import { useState, useEffect } from 'react'

export interface Reply {
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

interface UseCommentStateParams {
  commentId: string
  initialContent: string
  initialLikesCount?: number
  user: { id: string } | null
  onEdit?: (id: string, newContent: string) => void
  onDelete?: (id: string) => void
  showToast: (message: string, type: 'success' | 'error') => void
}

/**
 * Encapsulates all stateful comment logic: like/unlike, replies, edit, delete, report.
 * Behavior is intentionally identical to the previous inline logic in CommentItem.tsx.
 */
export function useCommentState({
  commentId,
  initialContent,
  initialLikesCount,
  user,
  onEdit,
  onDelete,
  showToast,
}: UseCommentStateParams) {
  // Like state
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(initialLikesCount || 0)
  const [isLiking, setIsLiking] = useState(false)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(initialContent)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Reply state
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [replies, setReplies] = useState<Reply[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [isLoadingReplies, setIsLoadingReplies] = useState(false)

  // Modals
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  // Fetch initial like status and count (always, even for anonymous users)
  useEffect(() => {
    const fetchLikeStatus = async () => {
      try {
        let token = null
        if (user) {
          const { createClient } = await import('@/lib/supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token
        }

        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`/api/comments/${commentId}/like`, {
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
  }, [commentId, user])

  // Auto-load replies on mount if they exist
  useEffect(() => {
    const loadInitialReplies = async () => {
      try {
        const response = await fetch(`/api/comments/${commentId}/replies`)

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
  }, [commentId])

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

      const response = await fetch(`/api/comments/${commentId}/like`, {
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
      const response = await fetch(`/api/comments/${commentId}/replies`)

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

      const response = await fetch(`/api/comments/${commentId}/replies`, {
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

  const cancelReply = () => {
    setShowReplyForm(false)
    setReplyContent('')
    setReplyError('')
  }

  // Edit handlers
  const startEdit = () => {
    setIsEditing(true)
    setEditContent(initialContent)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditContent(initialContent)
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSavingEdit) return
    setIsSavingEdit(true)
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      })

      if (response.ok) {
        onEdit?.(commentId, editContent.trim())
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

      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        onDelete?.(commentId)
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

      const response = await fetch(`/api/comments/${commentId}/report`, {
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

  return {
    // Like
    isLiked,
    likeCount,
    isLiking,
    handleLike,

    // Edit
    isEditing,
    editContent,
    setEditContent,
    isSavingEdit,
    startEdit,
    cancelEdit,
    handleSaveEdit,

    // Reply
    showReplyForm,
    replyContent,
    setReplyContent,
    isSubmittingReply,
    replyError,
    replies,
    showReplies,
    isLoadingReplies,
    handleReply,
    handleSubmitReply,
    cancelReply,

    // Delete
    handleDelete,

    // Report
    showReportModal,
    setShowReportModal,
    handleReport,
    handleSubmitReport,

    // Auth modal
    showLoginModal,
    setShowLoginModal,
  }
}
