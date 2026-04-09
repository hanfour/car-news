'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ClubHeader } from '@/components/clubs/ClubHeader'
import { ClubTabs, type ClubTab } from '@/components/clubs/ClubTabs'
import { ClubPostComposer } from '@/components/clubs/ClubPostComposer'
import { ClubMemberList } from '@/components/clubs/ClubMemberList'
import { ClubAbout } from '@/components/clubs/ClubAbout'
import { ClubPostCard } from '@/components/clubs/ClubPostCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'

interface Club {
  id: string; name: string; slug: string; description?: string; brand?: string; model?: string
  cover_image?: string; avatar_url?: string; owner_id: string; member_count: number; post_count: number
  rules?: string; is_private?: boolean; created_at?: string
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
  const [memberRole, setMemberRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ClubTab>('posts')

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
    } catch (err) { console.error('[ClubDetailPage] fetchData:', err) } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [slug])

  // Check membership
  useEffect(() => {
    if (!club || !user) return
    if (club.owner_id === user.id) {
      setIsMember(true)
      setMemberRole('owner')
      return
    }

    // Check via members API
    const checkMembership = async () => {
      try {
        const res = await fetch(`/api/clubs/${slug}/members`)
        if (res.ok) {
          const data = await res.json()
          const membership = data.members?.find((m: { user_id: string }) => m.user_id === user.id)
          if (membership) {
            setIsMember(true)
            setMemberRole(membership.role)
          }
        }
      } catch (err) { console.error('[ClubDetailPage] checkMembership:', err) }
    }
    checkMembership()
  }, [club, user, slug])

  if (loading) return <LoadingCenter size="lg" />

  if (!club) {
    return <div className="max-w-4xl mx-auto px-4 py-16"><EmptyState title="找不到此車友會" /></div>
  }

  const isOwner = user?.id === club.owner_id
  const isAdmin = memberRole === 'admin'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <ClubHeader club={club} isMember={isMember} isOwner={isOwner} onStatusChange={fetchData} />

      <ClubTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        memberCount={club.member_count}
        postCount={club.post_count}
      />

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {session && (isMember || isOwner) && (
              <ClubPostComposer slug={slug} onPostCreated={fetchData} />
            )}
            {posts.length > 0 ? (
              <div className="space-y-3">
                {posts.map(post => <ClubPostCard key={post.id} post={post} />)}
              </div>
            ) : (
              <EmptyState title="還沒有貼文" description="成為第一個在車友會發文的人！" />
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <ClubMemberList slug={slug} isOwner={isOwner} isAdmin={isAdmin} />
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <ClubAbout club={club} />
        )}
      </div>
    </div>
  )
}
