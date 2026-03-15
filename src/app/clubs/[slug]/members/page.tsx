'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { UserCard } from '@/components/user/UserCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { createServiceClient } from '@/lib/supabase'

export default function ClubMembersPage() {
  const params = useParams()
  const slug = params.slug as string
  const [members, setMembers] = useState<Array<{ id: string; username?: string; display_name?: string; avatar_url?: string; bio?: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // 使用 client-side fetch
        const clubRes = await fetch(`/api/clubs/${slug}`)
        if (!clubRes.ok) return

        const { club } = await clubRes.json()
        if (!club) return

        // 目前沒有專門的成員 API，先顯示 club owner
        setMembers(club.owner ? [club.owner] : [])
      } catch { /* */ } finally { setLoading(false) }
    }
    fetchMembers()
  }, [slug])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href={`/clubs/${slug}`} className="hover:text-[var(--brand-primary)] transition-colors">車友會</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>成員</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : members.length > 0 ? (
          <div className="space-y-3">
            {members.map(member => <UserCard key={member.id} user={member} />)}
          </div>
        ) : (
          <EmptyState title="沒有成員" />
        )}
      </div>
    </div>
  )
}
