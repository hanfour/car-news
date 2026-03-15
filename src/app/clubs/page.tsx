'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClubCard } from '@/components/clubs/ClubCard'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/contexts/AuthContext'

interface Club {
  id: string; name: string; slug: string; description?: string; brand?: string; avatar_url?: string
  member_count: number; post_count: number
}

export default function ClubsPage() {
  const { session } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    const fetchClubs = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/clubs?page=${page}`)
        if (res.ok) {
          const data = await res.json()
          setClubs(data.clubs)
          setTotalPages(data.totalPages)
        }
      } catch { /* */ } finally { setLoading(false) }
    }
    fetchClubs()
  }, [page])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>車友會</h1>
          {session && (
            <Link href="/clubs/create" className="btn-primary text-sm">建立車友會</Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : clubs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clubs.map(club => <ClubCard key={club.id} club={club} />)}
            </div>
            <div className="mt-6"><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        ) : (
          <EmptyState title="還沒有車友會" description="建立第一個車友會，召集志同道合的車友！" />
        )}
      </div>
    </div>
  )
}
