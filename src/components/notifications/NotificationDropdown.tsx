'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { NotificationItem } from './NotificationItem'

interface Notification {
  id: string
  type: string
  body?: string
  is_read: boolean
  created_at: string
  resource_type?: string
  resource_id?: string
  metadata: Record<string, string>
  actor?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { session } = useAuth()
  const { refreshCount } = useNotifications()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!session?.access_token) return

      try {
        const res = await fetch('/api/notifications?limit=10', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
  }, [session?.access_token])

  const handleMarkAllRead = async () => {
    if (!session?.access_token) return

    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      await refreshCount()
    } catch {
      // Silently fail
    }
  }

  return (
    <div
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-color)', zIndex: 9999 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e5e5' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>通知</h3>
        <button
          onClick={handleMarkAllRead}
          className="text-xs hover:text-[var(--brand-primary)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          全部已讀
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onClick={onClose} />
          ))
        ) : (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            目前沒有通知
          </div>
        )}
      </div>

      <div className="border-t px-4 py-2" style={{ borderColor: '#e5e5e5' }}>
        <Link
          href="/notifications"
          onClick={onClose}
          className="block text-center text-xs font-medium hover:text-[var(--brand-primary)] transition-colors py-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          查看所有通知
        </Link>
      </div>
    </div>
  )
}
