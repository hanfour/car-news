'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { UserCard } from '@/components/user/UserCard'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'

interface UserItem {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
}

export default function FollowingPage() {
  const params = useParams()
  const username = params.username as string
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    const fetchFollowing = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/user/${username}/following?page=${page}`)
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users)
          setTotalPages(data.totalPages)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchFollowing()
  }, [username, page])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href={`/user/${username}`} className="hover:text-[var(--brand-primary)] transition-colors">
            @{username}
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>追蹤中</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-3">
            {users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState title="還沒有追蹤任何人" description="開始追蹤其他用戶來看到他們的動態" />
        )}
      </div>
    </div>
  )
}
