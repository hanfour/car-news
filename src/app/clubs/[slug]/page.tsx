'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { useAuth } from '@/contexts/AuthContext'
import { JoinClubButton } from '@/components/clubs/JoinClubButton'
import { ClubPostCard } from '@/components/clubs/ClubPostCard'
import { MarkdownEditor } from '@/components/shared/MarkdownEditor'
import { EmptyState } from '@/components/shared/EmptyState'

interface Club {
  id: string; name: string; slug: string; description?: string; brand?: string; model?: string
  cover_image?: string; avatar_url?: string; owner_id: string; member_count: number; post_count: number
  owner?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

interface Post {
  id: string; content: string; like_count: number; reply_count: number; created_at: string
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

export default function ClubDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const { user, session } = useAuth()
  const [club, setClub] = useState<Club | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)

  const fetchData = async () => {
    try {
      const [clubRes, postsRes] = await Promise.all([
        fetch(`/api/clubs/${slug}`),
        fetch(`/api/clubs/${slug}/posts`),
      ])
      if (clubRes.ok) {
        const data = await clubRes.json()
        setClub(data.club)
      }
      if (postsRes.ok) {
        const data = await postsRes.json()
        setPosts(data.posts)
      }
    } catch { /* */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [slug])

  // 簡單判斷是否為成員（通過能否查看貼文來判定）
  useEffect(() => {
    if (club && user) {
      setIsMember(club.owner_id === user.id)
    }
  }, [club, user])

  const handlePost = async () => {
    if (!session?.access_token || !newPost.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/clubs/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: newPost }),
      })
      if (res.ok) {
        setNewPost('')
        fetchData()
      }
    } catch { /* */ } finally { setPosting(false) }
  }

  if (loading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
    </div>
  }

  if (!club) {
    return <div className="max-w-4xl mx-auto px-4 py-16"><EmptyState title="找不到此車友會" /></div>
  }

  const isOwner = user?.id === club.owner_id

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="h-32 sm:h-48 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] relative">
        {club.cover_image && isValidImageUrl(club.cover_image) && (
          <Image src={club.cover_image} alt="" fill className="object-cover" unoptimized />
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 relative">
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 -mt-10 border-4 border-white">
              {club.avatar_url && isValidImageUrl(club.avatar_url) ? (
                <Image src={club.avatar_url} alt="" width={64} height={64} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full bg-[var(--brand-primary-lighter)] flex items-center justify-center">
                  <span className="text-xl font-bold" style={{ color: 'var(--brand-primary-dark)' }}>{club.name[0]}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{club.name}</h1>
                  {club.description && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{club.description}</p>}
                </div>
                <JoinClubButton slug={slug} isMember={isMember} isOwner={isOwner} onStatusChange={fetchData} />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {club.brand && <span className="px-2 py-0.5 rounded-full bg-[var(--brand-primary-lighter)]">{club.brand}</span>}
                <Link href={`/clubs/${slug}/members`} className="hover:text-[var(--brand-primary)] transition-colors">
                  {club.member_count} 成員
                </Link>
                <span>{club.post_count} 貼文</span>
              </div>
            </div>
          </div>
        </div>

        {/* New Post */}
        {session && (isMember || isOwner) && (
          <div className="mt-4 bg-white rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
            <MarkdownEditor value={newPost} onChange={setNewPost} placeholder="分享你的想法..." rows={3} maxLength={5000} />
            <div className="flex justify-end mt-2">
              <button onClick={handlePost} disabled={posting || !newPost.trim()} className="btn-primary text-sm disabled:opacity-60">
                {posting ? '發布中...' : '發表'}
              </button>
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="mt-4 space-y-3 pb-8">
          {posts.length > 0 ? (
            posts.map(post => <ClubPostCard key={post.id} post={post} />)
          ) : (
            <EmptyState title="還沒有貼文" description="成為第一個在車友會發文的人！" />
          )}
        </div>
      </div>
    </div>
  )
}
