'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginModal } from './LoginModal'

interface CommentFormProps {
  articleId: string
  isLoggedIn?: boolean
  onLoginRequired?: () => void
}

export function CommentForm({ articleId, isLoggedIn = false, onLoginRequired }: CommentFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 如果未登錄，顯示登入 Modal
    if (!isLoggedIn) {
      setShowLoginModal(true)
      if (onLoginRequired) onLoginRequired()
      return
    }

    setError('')
    setSuccess(false)

    // Validation
    if (!content.trim()) {
      setError('請輸入評論內容')
      return
    }

    if (content.length > 2000) {
      setError('評論不能超過 2000 個字元')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_id: articleId,
          author_name: 'Current User', // TODO: Get from auth
          content: content.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '提交失敗，請稍後再試')
        return
      }

      setSuccess(true)
      setContent('')

      // Refresh the page to show new comment
      setTimeout(() => {
        router.refresh()
        setSuccess(false)
      }, 1500)

    } catch (err) {
      setError('網絡錯誤，請檢查您的連接')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            評論已提交！正在刷新頁面...
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-transparent resize-none text-base"
          style={{ outline: 'none' }}
          onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px #FFBB00'}
          onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
          placeholder="寫下你的評論..."
          disabled={isSubmitting}
        />

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-500">
            {content.length}/2000
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            style={{ backgroundColor: isSubmitting ? '#9CA3AF' : '#FFBB00' }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#E5A800')}
            onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#FFBB00')}
          >
            {isSubmitting ? '提交中...' : '提交評論'}
          </button>
        </div>
      </form>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}
