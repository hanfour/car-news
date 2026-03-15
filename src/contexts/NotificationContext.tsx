'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface NotificationContextType {
  unreadCount: number
  refreshCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshCount = useCallback(async () => {
    if (!session?.access_token) {
      setUnreadCount(0)
      return
    }

    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count || 0)
      }
    } catch {
      // Silently fail
    }
  }, [session?.access_token])

  useEffect(() => {
    refreshCount()

    // Polling every 30 seconds
    if (session?.access_token) {
      intervalRef.current = setInterval(refreshCount, 30000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [session?.access_token, refreshCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
