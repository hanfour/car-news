'use client'

import { createContext, useContext } from 'react'
import { useUnreadCount } from '@/hooks/useUnreadCount'

interface NotificationContextType {
  unreadCount: number
  refreshCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

/**
 * 未讀通知 Provider。過去自刻 setInterval + useState + useRef 同步 token，
 * 現在由 SWR（useUnreadCount）統一處理 polling / dedup / focus-revalidate，
 * Provider 只做 context 轉接。
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { unreadCount, refresh } = useUnreadCount()

  const refreshCount = async () => {
    await refresh()
  }

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
