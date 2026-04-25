'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

// 跨 tab 同步：登出時 broadcast，其他開著的 tab 也會收到並 reload
// 此 channel 名稱寫死在 client；不可配置（因為兩端都要對齊）
const AUTH_CHANNEL = 'wantcar-auth-sync'
type AuthBroadcast = { type: 'signout' }

interface Profile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  location?: string
  cover_image_url?: string
  is_favorites_public?: boolean
  followers_count?: number
  following_count?: number
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

  // 使用 useMemo 确保只创建一次客户端实例
  const supabase = useMemo(() => createClient(), [])

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

    // 跨 tab 登出：其他 tab 觸發 signOut 後本 tab reload 取最新狀態。
    // 用 BroadcastChannel（modern browser 都支援；不存在則 silent 退化）。
    let channel: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(AUTH_CHANNEL)
      channel.onmessage = (e: MessageEvent<AuthBroadcast>) => {
        if (e.data?.type === 'signout') {
          // 重新載入：避免 cached SWR / context state 帶著舊使用者資料
          window.location.href = '/'
        }
      }
    }

    return () => {
      subscription.unsubscribe()
      channel?.close()
    }
  }, [])

  const signOut = async () => {
    // 先清除所有 Supabase localStorage keys
    // 這樣可以確保即使 supabase.auth.signOut() 失敗，用戶也會被登出
    // 從 NEXT_PUBLIC_SUPABASE_URL 動態取得 project ref
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
    const storageKeys = [
      `sb-${projectRef}-auth-token`,
      `sb-${projectRef}-auth-token-code-verifier`,
      `supabase.auth.token`,
    ]

    storageKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key)
      }
    })

    // 呼叫 Supabase 登出 API
    await supabase.auth.signOut()

    // 清除 React state
    setUser(null)
    setProfile(null)
    setSession(null)

    // 通知其他開著的 tab 也登出（同 origin 才能收到 BroadcastChannel）
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(AUTH_CHANNEL)
        ch.postMessage({ type: 'signout' } as AuthBroadcast)
        ch.close()
      } catch {
        // BroadcastChannel 不可用時 silent 退化（其他 tab 仍會在下次 onAuthStateChange 觸發時自更新）
      }
    }

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
