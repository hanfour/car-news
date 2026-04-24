'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface NotificationContextType {
  unreadCount: number
  refreshCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

async function fetchUnreadCount(accessToken: string): Promise<number | null> {
  try {
    const res = await fetch('/api/notifications/unread-count', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.count === 'number' ? data.count : 0
  } catch {
    return null
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  // 透過 ref 暴露最新的 token，讓 refreshCount 不需要重建（ref 更新放在 effect 避免 render 期間 mutation）
  const tokenRef = useRef<string | undefined>(session?.access_token)
  useEffect(() => {
    tokenRef.current = session?.access_token
  }, [session?.access_token])

  // 登出狀態直接 derive，避免 effect 內 setState 造成 cascading render
  const visibleCount = session?.access_token ? unreadCount : 0

  // Polling：切換帳號時才重建 interval，refresh 邏輯內聯避免 memoization 警告
  useEffect(() => {
    if (!session?.access_token) return

    let cancelled = false
    const doRefresh = async () => {
      const token = tokenRef.current
      if (!token) return
      const count = await fetchUnreadCount(token)
      if (!cancelled && count !== null) setUnreadCount(count)
    }

    doRefresh()
    const intervalId = setInterval(doRefresh, 30000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [session?.access_token])

  // 對外曝露的 refreshCount 用 ref 讀 token，consumer 不會因 token 變動取得不同 reference
  const refreshCount = async () => {
    const token = tokenRef.current
    if (!token) return
    const count = await fetchUnreadCount(token)
    if (count !== null) setUnreadCount(count)
  }

  return (
    <NotificationContext.Provider value={{ unreadCount: visibleCount, refreshCount }}>
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
