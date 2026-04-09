'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface TopicFollowButtonProps {
  topicType: 'brand' | 'car_model' | 'category'
  topicValue: string
  initialFollowing?: boolean
  className?: string
}

export function TopicFollowButton({ topicType, topicValue, initialFollowing = false, className = '' }: TopicFollowButtonProps) {
  const { session } = useAuth()
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!session?.access_token) return

    setLoading(true)
    try {
      const res = await fetch('/api/topics/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ topic_type: topicType, topic_value: topicValue }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsFollowing(data.isFollowing)
      }
    } catch (err) {
      console.error('[TopicFollowButton] checkFollowStatus:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!session) return null

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        isFollowing
          ? 'border hover:bg-gray-50'
          : 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]'
      } ${className}`}
      style={{
        borderColor: isFollowing ? 'var(--border-color)' : undefined,
        color: isFollowing ? 'var(--text-secondary)' : 'var(--text-primary)',
      }}
    >
      {loading ? '...' : isFollowing ? '已追蹤' : '追蹤'}
    </button>
  )
}
