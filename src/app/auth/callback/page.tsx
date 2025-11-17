'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      // 檢查是否有 hash fragment (Implicit Flow)
      const hash = window.location.hash

      if (hash && hash.length > 1) {
        console.log('[Auth] Implicit flow detected')

        // 解析 hash
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const expiresIn = params.get('expires_in')

        if (accessToken && refreshToken) {
          // 使用 Supabase client 的 setSession() 來正確設置 session
          // 這會自動處理 localStorage 和 cookies
          const supabase = createClient()

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (error) {
            console.error('[Auth] Failed to set session:', error)
            router.replace('/auth/error?reason=session_error')
            return
          }

          console.log('[Auth] Session set successfully')

          // 讀取返回 URL
          const cookies = document.cookie.split(';')
          const returnUrlCookie = cookies.find(c => c.trim().startsWith('auth_return_url='))
          const returnUrl = returnUrlCookie
            ? decodeURIComponent(returnUrlCookie.split('=')[1])
            : '/'

          // 清除 cookie
          document.cookie = 'auth_return_url=; path=/; max-age=0'

          console.log('[Auth] Redirecting to:', returnUrl)

          // 重定向（不帶 hash）
          router.replace(returnUrl)
        } else {
          console.error('[Auth] Missing tokens in hash')
          router.replace('/auth/error?reason=missing_tokens')
        }
      } else {
        // 沒有 hash，檢查是否已有 session
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
        if (projectRef) {
          const storageKey = `sb-${projectRef}-auth-token`
          const existingSession = localStorage.getItem(storageKey)

          if (existingSession) {
            console.log('[Auth] Session exists, redirecting to home')
            router.replace('/')
          } else {
            console.log('[Auth] No session and no hash, redirect to home')
            router.replace('/')
          }
        } else {
          router.replace('/')
        }
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">登入中...</h2>
        <p className="text-gray-600">請稍候，正在完成認證</p>
      </div>
    </div>
  )
}
