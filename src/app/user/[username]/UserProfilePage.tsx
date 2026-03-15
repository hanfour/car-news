'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { UserProfileHeader } from '@/components/user/UserProfileHeader'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'

interface UserProfilePageProps {
  username: string
  tab: 'comments' | 'favorites'
}

interface Comment {
  id: string
  content: string
  created_at: string
  article_id: string
  likes_count: number
  article?: {
    id: string
    title_zh: string
    slug_en: string
    published_at: string
  }
}

interface Favorite {
  article_id: string
  created_at: string
  article?: {
    id: string
    title_zh: string
    slug_en: string
    published_at: string
    cover_image: string
    categories: string[]
    primary_brand: string
  }
}

interface Profile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  location?: string
  cover_image_url?: string
  is_favorites_public?: boolean
  followers_count?: number
  following_count?: number
  comments_count?: number
  created_at: string
}

function getArticleUrl(article: { id: string; slug_en: string; published_at: string }) {
  const date = new Date(article.published_at)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `/${year}/${month}/${article.id}`
}

export function UserProfilePage({ username, tab }: UserProfilePageProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // 載入個人檔案
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user/${username}`)
        const data = await res.json()
        if (res.ok) {
          setProfile(data.profile)
        } else {
          setError(data.error || '找不到此使用者')
        }
      } catch {
        setError('載入失敗')
      }
    }
    fetchProfile()
  }, [username])

  // 載入內容
  useEffect(() => {
    if (!profile) return

    const fetchContent = async () => {
      setLoading(true)
      const displayUsername = profile.username || profile.id

      try {
        if (tab === 'comments') {
          const res = await fetch(`/api/user/${displayUsername}/comments?page=${page}`)
          const data = await res.json()
          if (res.ok) {
            setComments(data.comments)
            setTotalPages(data.totalPages)
          }
        } else {
          const res = await fetch(`/api/user/${displayUsername}/favorites?page=${page}`)
          const data = await res.json()
          if (res.ok) {
            setFavorites(data.favorites)
            setTotalPages(data.totalPages)
          } else if (res.status === 403) {
            setError('此使用者的收藏為私人')
          }
        }
      } catch {
        setError('載入失敗')
      } finally {
        setLoading(false)
      }
    }
    fetchContent()
  }, [profile, tab, page])

  if (error && !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title={error}
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  const isSelf = user?.id === profile.id

  return (
    <div>
      <UserProfileHeader profile={profile} isSelf={isSelf} activeTab={tab} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : tab === 'comments' ? (
          comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white rounded-lg p-4 border"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {comment.article && (
                    <Link
                      href={getArticleUrl(comment.article)}
                      className="text-xs font-medium hover:text-[var(--brand-primary)] transition-colors block mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {comment.article.title_zh}
                    </Link>
                  )}
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{new Date(comment.created_at).toLocaleDateString('zh-TW')}</span>
                    {comment.likes_count > 0 && <span>{comment.likes_count} 個讚</span>}
                  </div>
                </div>
              ))}
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : (
            <EmptyState title="還沒有評論" description="此使用者尚未發表任何評論" />
          )
        ) : error === '此使用者的收藏為私人' ? (
          <EmptyState
            title="收藏為私人"
            description="此使用者已將收藏設為私人，無法檢視"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />
        ) : favorites.length > 0 ? (
          <div className="space-y-3">
            {favorites.map((fav) =>
              fav.article ? (
                <Link
                  key={fav.article_id}
                  href={getArticleUrl(fav.article)}
                  className="block bg-white rounded-lg p-4 border transition-colors hover:border-[var(--brand-primary)]"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {fav.article.title_zh}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {fav.article.primary_brand && <span>{fav.article.primary_brand}</span>}
                    <span>收藏於 {new Date(fav.created_at).toLocaleDateString('zh-TW')}</span>
                  </div>
                </Link>
              ) : null
            )}
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState title="還沒有收藏" description="此使用者尚未收藏任何文章" />
        )}
      </div>
    </div>
  )
}
