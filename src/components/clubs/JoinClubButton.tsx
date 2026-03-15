'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface JoinClubButtonProps {
  slug: string
  isMember: boolean
  isOwner: boolean
  onStatusChange?: () => void
}

export function JoinClubButton({ slug, isMember, isOwner, onStatusChange }: JoinClubButtonProps) {
  const { session } = useAuth()
  const [joined, setJoined] = useState(isMember)
  const [loading, setLoading] = useState(false)

  if (isOwner) return null
  if (!session) return null

  const handleToggle = async () => {
    if (!session?.access_token) return

    setLoading(true)
    try {
      if (joined) {
        const res = await fetch(`/api/clubs/${slug}/leave`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          setJoined(false)
          onStatusChange?.()
        }
      } else {
        const res = await fetch(`/api/clubs/${slug}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          setJoined(true)
          onStatusChange?.()
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        joined
          ? 'border hover:bg-gray-50'
          : 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]'
      }`}
      style={{
        borderColor: joined ? 'var(--border-color)' : undefined,
        color: joined ? 'var(--text-secondary)' : 'var(--text-primary)',
      }}
    >
      {loading ? '...' : joined ? '已加入' : '加入車友會'}
    </button>
  )
}
