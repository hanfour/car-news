'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ClubMemberList } from '@/components/clubs/ClubMemberList'
import { useAuth } from '@/contexts/AuthContext'

export default function ClubMembersPage() {
  const params = useParams()
  const slug = params.slug as string
  const { user } = useAuth()
  const [clubName, setClubName] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchClubInfo = async () => {
      try {
        // Single API call to get club info (includes owner_id)
        const res = await fetch(`/api/clubs/${slug}`)
        if (!res.ok) return
        const { club } = await res.json()
        if (!club) return
        setClubName(club.name || '')
        if (user) {
          setIsOwner(club.owner_id === user.id)
        }
      } catch { /* */ } finally {
        setLoading(false)
      }
    }
    fetchClubInfo()
  }, [slug, user])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href={`/clubs/${slug}`} className="hover:text-[var(--brand-primary)] transition-colors">
            {clubName || '車友會'}
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>成員</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : (
          <ClubMemberList slug={slug} isOwner={isOwner} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  )
}
