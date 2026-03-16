'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface MyClub {
  id: string
  name: string
  slug: string
  avatar_url?: string | null
}

interface NavigationContextType {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  myClubs: MyClub[]
  loadingClubs: boolean
  refreshMyClubs: () => Promise<void>
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [sidebarOpen, setSidebarOpenState] = useState(false)
  const [myClubs, setMyClubs] = useState<MyClub[]>([])
  const [loadingClubs, setLoadingClubs] = useState(false)

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-open', String(open))
    }
  }, [])

  // Restore sidebar state on mount (desktop only)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      const saved = localStorage.getItem('sidebar-open')
      if (saved === 'true') {
        setSidebarOpenState(true)
      }
    }
  }, [])

  const refreshMyClubs = useCallback(async () => {
    if (!session?.access_token) {
      setMyClubs([])
      return
    }

    setLoadingClubs(true)
    try {
      const res = await fetch('/api/clubs/my', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMyClubs(data.clubs || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingClubs(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    refreshMyClubs()
  }, [refreshMyClubs])

  return (
    <NavigationContext.Provider value={{ sidebarOpen, setSidebarOpen, myClubs, loadingClubs, refreshMyClubs }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}
