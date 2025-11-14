'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginModal } from './LoginModal'

interface CommentFormProps {
  articleId: string
  isLoggedIn?: boolean
  onLoginRequired?: () => void
}

function CommentFormInner({ articleId, isLoggedIn = false, onLoginRequired }: CommentFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // localStorage key for draft comment
  const draftKey = `comment_draft_${articleId}`

  // 載入草稿內容
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const draft = localStorage.getItem(draftKey)
      if (draft) {
        setContent(draft)
      }
    }
  }, [draftKey])

  // 檢查登入成功後自動提交
  useEffect(() => {
    const authSuccess = searchParams?.get('auth')
    if (authSuccess === 'success' && isLoggedIn && content.trim()) {
      // 登入成功後，如果有草稿內容，自動提交
      console.log('Auto-submitting comment after login')
      handleSubmit(new Event('submit') as any)
    }
  }, [searchParams, isLoggedIn])

  // 保存草稿到 localStorage
  const saveDraft = (text: string) => {
    if (typeof window !== 'undefined') {
      if (text.trim()) {
        localStorage.setItem(draftKey, text)
      } else {
        localStorage.removeItem(draftKey)
      }
    }
  }

  // 清除草稿
  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftKey)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 如果未登錄，保存草稿並顯示登入 Modal
    if (!isLoggedIn) {
      saveDraft(content)
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
      clearDraft() // 清除草稿

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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[var(--brand-red)] text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-[var(--brand-green)] text-sm">
            評論已提交！正在刷新頁面...
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            saveDraft(e.target.value) // 即時保存草稿
          }}
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-transparent resize-none text-base"
          style={{ outline: 'none' }}
          onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px #FDB90B'}
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
            className={`px-6 py-2 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${
              isSubmitting ? 'bg-text-disabled' : 'bg-brand-primary hover:bg-brand-primary-hover'
            }`}
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

export function CommentForm(props: CommentFormProps) {
  return (
    <Suspense fallback={
      <div className="mb-6 animate-pulse">
        <div className="w-full h-32 bg-gray-200 rounded-lg mb-3"></div>
        <div className="flex justify-between">
          <div className="w-16 h-4 bg-gray-200 rounded"></div>
          <div className="w-24 h-10 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    }>
      <CommentFormInner {...props} />
    </Suspense>
  )
}
