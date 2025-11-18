'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginModal } from '@/components/LoginModal'
import { ReportModal } from '@/components/ReportModal'

interface ArticleActionBarProps {
  articleId: string
  title: string
  viewCount: number
  commentCount: number
  initialLikeCount?: number
}

export function ArticleActionBar({ articleId, title, viewCount, commentCount, initialLikeCount = 0 }: ArticleActionBarProps) {
  const { user } = useAuth()
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [likeHover, setLikeHover] = useState(false)
  const [saveHover, setSaveHover] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  const shareMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  // Fetch initial like and favorite status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Get session if user is logged in
        let token = null
        if (user) {
          const { createClient } = await import('@/lib/supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token
        }

        // Fetch like status
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const [likeResponse, favoriteResponse] = await Promise.all([
          fetch(`/api/articles/${articleId}/like`, { headers }),
          token ? fetch(`/api/articles/${articleId}/favorite`, { headers }) : null
        ])

        if (likeResponse.ok) {
          const likeData = await likeResponse.json()
          setIsLiked(likeData.isLiked)
          setLikeCount(likeData.likeCount)
        }

        if (favoriteResponse?.ok) {
          const favoriteData = await favoriteResponse.json()
          setIsSaved(favoriteData.isFavorited)
        }
      } catch (error) {
        console.error('Failed to fetch status:', error)
      }
    }

    fetchStatus()
  }, [articleId, user])

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (shareMenuRef.current && !shareMenuRef.current.contains(target)) {
        setShowShareMenu(false)
      }

      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

      const response = await fetch(`/api/articles/${articleId}/like`, {
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

  const handleSave = async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    if (isSaving) return

    setIsSaving(true)

    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setShowLoginModal(true)
        setIsSaving(false)
        return
      }

      const response = await fetch(`/api/articles/${articleId}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIsSaved(data.isFavorited)
      } else {
        const error = await response.json()
        console.error('Save failed:', error)
      }
    } catch (error) {
      console.error('Failed to toggle save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleShareMenu = () => {
    setShowShareMenu(!showShareMenu)
    setShowMoreMenu(false)
  }

  const toggleMoreMenu = () => {
    setShowMoreMenu(!showMoreMenu)
    setShowShareMenu(false)
  }

  const handleShare = async (platform: string) => {
    const encodedTitle = encodeURIComponent(title)
    const encodedUrl = encodeURIComponent(currentUrl)

    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
      instagram: '',
    }

    // Record share event in database
    try {
      // Get session if user is logged in
      let token = null
      if (user) {
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Record share (fire and forget - don't block the share action)
      fetch(`/api/articles/${articleId}/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ platform })
      }).catch(err => console.error('Failed to record share:', err))
    } catch (error) {
      console.error('Failed to record share:', error)
    }

    // Perform share action
    if (platform === 'copy') {
      navigator.clipboard.writeText(currentUrl)
      alert('連結已複製！')
    } else if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    }

    setShowShareMenu(false)
  }

  const handleReport = () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    setShowMoreMenu(false)
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

      const response = await fetch(`/api/articles/${articleId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason, description })
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message || '檢舉已提交，我們會盡快處理。')
      } else {
        alert(data.error || '檢舉失敗，請稍後再試。')
      }
    } catch (error) {
      console.error('Failed to report:', error)
      alert('檢舉失敗，請稍後再試。')
      throw error
    }
  }

  return (
    <>
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* 左側：統計資訊 */}
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>{viewCount}次閱讀</span>
            <span>{commentCount}評論</span>
            <span>{likeCount}喜歡</span>
          </div>

          {/* 右側：互動按鈕 */}
          <div className="flex items-center gap-3">
            {/* 喜歡 */}
            <button
              onClick={handleLike}
              disabled={isLiking}
              onMouseEnter={() => setLikeHover(true)}
              onMouseLeave={() => setLikeHover(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isLiked
                  ? (likeHover ? 'bg-brand-primary-light text-brand-primary' : 'bg-brand-primary-lighter text-brand-primary')
                  : (likeHover ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-600')
              }`}
            >
              <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span className="text-sm font-medium">喜歡</span>
            </button>

            {/* 收藏 */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              onMouseEnter={() => setSaveHover(true)}
              onMouseLeave={() => setSaveHover(false)}
              className={`p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isSaved
                  ? (saveHover ? 'bg-brand-primary-light text-brand-primary' : 'bg-brand-primary-lighter text-brand-primary')
                  : (saveHover ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-600')
              }`}
              title="收藏"
            >
              <svg className="w-5 h-5" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>

            {/* 分享 */}
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={toggleShareMenu}
                className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="分享"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              {/* 分享選單 */}
              {showShareMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <button
                    onClick={() => handleShare('facebook')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                    Twitter
                  </button>
                  <button
                    onClick={() => handleShare('line')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                    </svg>
                    LINE
                  </button>
                  <button
                    onClick={() => handleShare('copy')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    複製連結
                  </button>
                </div>
              )}
            </div>

            {/* More */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={toggleMoreMenu}
                className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="更多"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* More 選單 */}
              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <button
                    onClick={handleReport}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-[var(--brand-red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    回報錯誤
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSubmitReport}
        type="article"
        title={title}
      />
    </>
  )
}
