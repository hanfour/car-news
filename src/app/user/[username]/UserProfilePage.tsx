'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { UserProfileHeader, type ProfileTab } from '@/components/user/UserProfileHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'
import { Avatar } from '@/components/shared/Avatar'
import { CarCard } from '@/components/garage/CarCard'
import { timeAgo } from '@/lib/utils/timeAgo'

interface UserProfilePageProps {
  username: string
  tab: ProfileTab
}

interface Profile {
  id: string; username?: string; display_name?: string; avatar_url?: string; bio?: string
  website?: string; location?: string; cover_image_url?: string; is_favorites_public?: boolean
  followers_count?: number; following_count?: number; comments_count?: number
  forum_post_count?: number; car_count?: number; created_at: string
}

function getArticleUrl(article: { id: string; slug_en: string; published_at: string }) {
  const date = new Date(article.published_at)
  return `/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${article.id}`
}

export function UserProfilePage({ username, tab }: UserProfilePageProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [content, setContent] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user/${username}`)
        const data = await res.json()
        if (res.ok) setProfile(data.profile)
        else setError(data.error || '找不到此使用者')
      } catch { setError('載入失敗') }
    }
    fetchProfile()
  }, [username])

  useEffect(() => {
    if (!profile) return

    const fetchContent = async () => {
      setLoading(true)
      setContent([])
      const displayUsername = profile.username || profile.id

      try {
        let res: Response
        switch (tab) {
          case 'posts':
            res = await fetch(`/api/user/${displayUsername}/posts`)
            if (res.ok) { const data = await res.json(); setContent(data.posts || []) }
            break
          case 'comments':
            res = await fetch(`/api/user/${displayUsername}/comments?page=1`)
            if (res.ok) { const data = await res.json(); setContent(data.comments || []) }
            break
          case 'favorites':
            res = await fetch(`/api/user/${displayUsername}/favorites?page=1`)
            if (res.ok) { const data = await res.json(); setContent(data.favorites || []) }
            else if (res.status === 403) setError('此使用者的收藏為私人')
            break
          case 'garage':
            res = await fetch(`/api/garage/wall?owner=${displayUsername}`)
            if (res.ok) { const data = await res.json(); setContent(data.cars || []) }
            break
          case 'clubs':
            res = await fetch(`/api/user/${displayUsername}/clubs`)
            if (res.ok) { const data = await res.json(); setContent(data.clubs || []) }
            break
        }
      } catch { setError('載入失敗') } finally { setLoading(false) }
    }
    fetchContent()
  }, [profile, tab])

  if (error && !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState title={error} />
      </div>
    )
  }

  if (!profile) return <LoadingCenter size="lg" />

  const isSelf = user?.id === profile.id

  return (
    <div>
      <UserProfileHeader profile={profile} isSelf={isSelf} activeTab={tab} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <LoadingCenter />
        ) : (
          <>
            {/* Posts Tab */}
            {tab === 'posts' && (
              content.length > 0 ? (
                <div className="space-y-3">
                  {(content as { id: string; title: string; content: string; reply_count: number; like_count: number; created_at: string; category?: { name: string; slug: string } }[]).map(post => (
                    <Link
                      key={post.id}
                      href={`/community/post/${post.id}`}
                      className="block bg-white rounded-lg border p-4 transition-colors hover:border-[var(--brand-primary)]"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{post.title}</h3>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {post.content.replace(/[#*`\[\]]/g, '').substring(0, 150)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span>{timeAgo(post.created_at)}</span>
                        {post.category && <span>{post.category.name}</span>}
                        <span>{post.reply_count} 回覆</span>
                        {post.like_count > 0 && <span>{post.like_count} 讚</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title="還沒有貼文" description="此使用者尚未發表任何貼文" />
            )}

            {/* Comments Tab */}
            {tab === 'comments' && (
              content.length > 0 ? (
                <div className="space-y-4">
                  {(content as { id: string; content: string; created_at: string; likes_count: number; article?: { id: string; title_zh: string; slug_en: string; published_at: string } }[]).map(comment => (
                    <div key={comment.id} className="bg-white rounded-lg p-4 border" style={{ borderColor: 'var(--border-color)' }}>
                      {comment.article && (
                        <Link
                          href={getArticleUrl(comment.article)}
                          className="text-xs font-medium hover:text-[var(--brand-primary)] transition-colors block mb-2"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {comment.article.title_zh}
                        </Link>
                      )}
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{comment.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span>{new Date(comment.created_at).toLocaleDateString('zh-TW')}</span>
                        {comment.likes_count > 0 && <span>{comment.likes_count} 個讚</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="還沒有評論" description="此使用者尚未發表任何評論" />
            )}

            {/* Favorites Tab */}
            {tab === 'favorites' && (
              error === '此使用者的收藏為私人' ? (
                <EmptyState title="收藏為私人" description="此使用者已將收藏設為私人" />
              ) : content.length > 0 ? (
                <div className="space-y-3">
                  {(content as { article_id: string; created_at: string; article?: { id: string; title_zh: string; slug_en: string; published_at: string; primary_brand: string } }[]).map(fav =>
                    fav.article ? (
                      <Link
                        key={fav.article_id}
                        href={getArticleUrl(fav.article)}
                        className="block bg-white rounded-lg p-4 border transition-colors hover:border-[var(--brand-primary)]"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fav.article.title_zh}</h3>
                        <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {fav.article.primary_brand && <span>{fav.article.primary_brand}</span>}
                          <span>收藏於 {new Date(fav.created_at).toLocaleDateString('zh-TW')}</span>
                        </div>
                      </Link>
                    ) : null
                  )}
                </div>
              ) : <EmptyState title="還沒有收藏" description="此使用者尚未收藏任何文章" />
            )}

            {/* Garage Tab */}
            {tab === 'garage' && (
              content.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(content as { id: string; brand: string; model: string; year?: number; nickname?: string; color?: string; cover_image?: string }[]).map(car => (
                    <CarCard key={car.id} car={car} showOwner={false} />
                  ))}
                </div>
              ) : <EmptyState title="還沒有展示愛車" description="此使用者尚未加入任何車輛" />
            )}

            {/* Clubs Tab */}
            {tab === 'clubs' && (
              content.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(content as { id: string; name: string; slug: string; description?: string; brand?: string; avatar_url?: string; member_count: number }[]).map(club => (
                    <Link
                      key={club.id}
                      href={`/clubs/${club.slug}`}
                      className="flex items-center gap-3 bg-white rounded-lg border p-4 transition-colors hover:border-[var(--brand-primary)]"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <Avatar src={club.avatar_url} name={club.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{club.name}</h3>
                        <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {club.brand && <span>{club.brand}</span>}
                          <span>{club.member_count} 成員</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title="還沒有加入車友會" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
