'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface Profile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data && !error) {
      setProfile(data)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    console.log('[Auth] Starting sign out...')

    // 先清除所有 Supabase localStorage keys
    // 這樣可以確保即使 supabase.auth.signOut() 失敗，用戶也會被登出
    const projectRef = 'daubcanyykdfyptntfco'
    const storageKeys = [
      `sb-${projectRef}-auth-token`,           // 我們寫入的格式
      `sb-${projectRef}-auth-token-code-verifier`,
      `supabase.auth.token`,                   // Supabase 預設格式
    ]

    console.log('[Auth] Clearing localStorage keys:', storageKeys)
    storageKeys.forEach(key => {
      const before = localStorage.getItem(key)
      if (before) {
        console.log(`[Auth] Found key "${key}", removing...`)
        localStorage.removeItem(key)
      }
    })

    // 呼叫 Supabase 登出 API
    await supabase.auth.signOut()

    // 清除 React state
    setUser(null)
    setProfile(null)
    setSession(null)

    console.log('[Auth] Sign out completed')

    // 強制重新整理頁面以確保所有狀態清除
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.href = '/'
      }, 100)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
