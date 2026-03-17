'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface FollowButtonProps {
  targetUsername: string
  targetUserId: string
  className?: string
}

export function FollowButton({ targetUsername, targetUserId, className = '' }: FollowButtonProps) {
  const { user, session } = useAuth()
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  const isSelf = user?.id === targetUserId

  // 檢查是否已追蹤
  useEffect(() => {
    if (!session?.access_token || !user || isSelf) return

    const checkFollow = async () => {
      try {
        const res = await fetch(`/api/user/${targetUsername}/follow`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setIsFollowing(data.isFollowing)
        }
      } catch {
        // Silently fail
      } finally {
        setChecked(true)
      }
    }
    checkFollow()
  }, [session?.access_token, targetUsername, user, isSelf])

  if (isSelf || !user || !checked) return null

  const handleToggle = async () => {
    if (!session?.access_token) return

    setLoading(true)
    try {
      const res = await fetch(`/api/user/${targetUsername}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setIsFollowing(data.isFollowing)
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
      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        isFollowing
          ? 'border hover:bg-gray-50'
          : 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]'
      } ${className}`}
      style={{
        borderColor: isFollowing ? 'var(--border-color)' : undefined,
        color: isFollowing ? 'var(--text-secondary)' : 'var(--text-primary)',
      }}
    >
      {loading ? '...' : isFollowing ? '追蹤中' : '追蹤'}
    </button>
  )
}
