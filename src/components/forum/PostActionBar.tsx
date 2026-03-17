'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const REPORT_REASONS = [
  { value: 'spam', label: '垃圾訊息' },
  { value: 'harassment', label: '騷擾' },
  { value: 'hate_speech', label: '仇恨言論' },
  { value: 'misinformation', label: '不實資訊' },
  { value: 'inappropriate', label: '不當內容' },
  { value: 'other', label: '其他' },
] as const

interface PostActionBarProps {
  postId: string
  likeCount: number
  replyCount: number
  bookmarkCount?: number
  isLiked?: boolean
  isBookmarked?: boolean
  onLike: () => void
  onBookmarkChange?: (bookmarked: boolean) => void
}

export function PostActionBar({
  postId,
  likeCount,
  replyCount,
  bookmarkCount = 0,
  isLiked = false,
  isBookmarked = false,
  onLike,
  onBookmarkChange,
}: PostActionBarProps) {
  const { session } = useAuth()
  const [bookmarked, setBookmarked] = useState(isBookmarked)
  const [copied, setCopied] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportResult, setReportResult] = useState<string | null>(null)

  const handleBookmark = async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch(`/api/forum/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBookmarked(data.isBookmarked)
        onBookmarkChange?.(data.isBookmarked)
      }
    } catch { /* */ }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/community/post/${postId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* */ }
  }

  const handleReport = async (reason: string) => {
    if (!session?.access_token) return
    setReportSubmitting(true)
    try {
      const res = await fetch(`/api/forum/posts/${postId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (res.ok) {
        setReportResult('檢舉已提交')
      } else {
        setReportResult(data.error || '檢舉失敗')
      }
    } catch {
      setReportResult('檢舉失敗')
    } finally {
      setReportSubmitting(false)
      setTimeout(() => {
        setShowReport(false)
        setReportResult(null)
      }, 2000)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-4 pt-4 border-t" style={{ borderColor: '#e5e5e5' }}>
        {/* Like */}
        <button
          onClick={onLike}
          className="flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--brand-primary)]"
          style={{ color: isLiked ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        {/* Reply count */}
        <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {replyCount > 0 && <span>{replyCount}</span>}
        </span>

        {/* Bookmark */}
        {session && (
          <button
            onClick={handleBookmark}
            className="flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--brand-primary)]"
            style={{ color: bookmarked ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--brand-primary)]"
          style={{ color: copied ? 'var(--brand-green)' : 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {copied && <span className="text-xs">已複製</span>}
        </button>

        {/* Report */}
        {session && (
          <button
            onClick={() => setShowReport(!showReport)}
            className="flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--brand-red)] ml-auto"
            style={{ color: 'var(--text-tertiary)' }}
            title="檢舉"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-13l9-5 9 5v13M3 8l9 4 9-4" />
            </svg>
          </button>
        )}
      </div>

      {/* Report dropdown */}
      {showReport && (
        <div
          className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-lg border shadow-lg z-10 py-1"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {reportResult ? (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{reportResult}</p>
          ) : reportSubmitting ? (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>提交中...</p>
          ) : (
            <>
              <p className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>選擇檢舉原因</p>
              {REPORT_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => handleReport(r.value)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {r.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
