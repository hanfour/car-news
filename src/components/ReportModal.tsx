'use client'

import { useState } from 'react'
import { useToast } from '@/components/ToastContainer'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string, description: string) => void
  type: 'article' | 'comment'
  title?: string
}

const ARTICLE_REASONS = [
  { value: 'spam', label: '垃圾內容', icon: '🗑️' },
  { value: 'misinformation', label: '錯誤資訊', icon: '⚠️' },
  { value: 'inappropriate', label: '不當內容', icon: '🚫' },
  { value: 'copyright', label: '侵權', icon: '©️' },
  { value: 'other', label: '其他', icon: '📝' },
]

const COMMENT_REASONS = [
  { value: 'spam', label: '垃圾內容', icon: '🗑️' },
  { value: 'harassment', label: '騷擾', icon: '😠' },
  { value: 'hate_speech', label: '仇恨言論', icon: '💢' },
  { value: 'misinformation', label: '錯誤資訊', icon: '⚠️' },
  { value: 'inappropriate', label: '不當內容', icon: '🚫' },
  { value: 'other', label: '其他', icon: '📝' },
]

export function ReportModal({ isOpen, onClose, onSubmit, type, title }: ReportModalProps) {
  const { showToast } = useToast()
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reasons = type === 'article' ? ARTICLE_REASONS : COMMENT_REASONS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedReason) {
      showToast('請選擇檢舉原因', 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(selectedReason, description)
      // Reset form
      setSelectedReason('')
      setDescription('')
      onClose()
    } catch (error) {
      console.error('Submit error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('')
      setDescription('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">
              檢舉{type === 'article' ? '文章' : '留言'}
            </h3>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {title && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{title}</p>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Reason Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              請選擇檢舉原因 <span className="text-red-500">*</span>
            </label>

            {reasons.map((reason) => (
              <label
                key={reason.value}
                className={`
                  flex items-center gap-3 p-2 text-sm rounded-xl border-2 cursor-pointer transition-all
                  ${selectedReason === reason.value
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason.value}
                  checked={selectedReason === reason.value}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="sr-only"
                />
                <span className="text-2xl">{reason.icon}</span>
                <span className={`font-medium ${selectedReason === reason.value ? 'text-red-700' : 'text-gray-700'}`}>
                  {reason.label}
                </span>
                {selectedReason === reason.value && (
                  <svg className="w-5 h-5 ml-auto text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </label>
            ))}
          </div>

          {/* Description */}
          <div className="mt-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              詳細說明（選填）
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="請描述您檢舉的具體原因..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
            <p className="mt-1 text-xs text-gray-500 text-right">
              {description.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedReason}
              className="flex-1 px-4 py-3 text-white bg-red-600 rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '提交中...' : '提交檢舉'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
