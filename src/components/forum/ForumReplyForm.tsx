'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MarkdownEditor } from '@/components/shared/MarkdownEditor'

interface ForumReplyFormProps {
  postId: string
  parentId?: string
  onReplyCreated: () => void
}

export function ForumReplyForm({ postId, parentId, onReplyCreated }: ForumReplyFormProps) {
  const { session } = useAuth()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token || !content.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/forum/posts/${postId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content, parent_id: parentId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '回覆失敗')
        return
      }

      setContent('')
      onReplyCreated()
    } catch {
      setError('系統錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (!session) {
    return (
      <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        請先登入才能回覆
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder="寫下你的回覆..."
        maxLength={5000}
        rows={4}
      />

      {error && (
        <p className="text-sm" style={{ color: 'var(--brand-red)' }}>{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="btn-primary disabled:opacity-60"
        >
          {submitting ? '送出中...' : '送出回覆'}
        </button>
      </div>
    </form>
  )
}
