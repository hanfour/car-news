'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'

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

export default function NotificationsPage() {
  const { session, loading: authLoading } = useAuth()
  const { refreshCount } = useNotifications()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!session?.access_token) return

      setLoading(true)
      try {
        const res = await fetch(`/api/notifications?page=${page}&limit=20`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications)
          setTotalPages(data.totalPages)
        }
      } catch (err) {
        console.error('[NotificationsPage] fetchNotifications:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
  }, [session?.access_token, page])

  const handleMarkAllRead = async () => {
    if (!session?.access_token) return

    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      await refreshCount()
    } catch (err) {
      console.error('[NotificationsPage] markAllRead:', err)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <EmptyState title="請先登入" description="登入後即可查看通知" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>通知</h1>
          <button
            onClick={handleMarkAllRead}
            className="text-sm hover:text-[var(--brand-primary)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            全部已讀
          </button>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y" style={{ borderColor: '#e5e5e5' }}>
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          ) : (
            <EmptyState title="沒有通知" description="目前沒有任何通知" />
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
