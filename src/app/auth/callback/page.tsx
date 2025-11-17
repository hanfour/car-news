'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = () => {
      // 檢查是否有 hash fragment (Implicit Flow)
      const hash = window.location.hash

      if (hash && hash.length > 1) {
        console.log('[Auth] Implicit flow detected')

        // 解析 hash
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const expiresIn = params.get('expires_in')
        const tokenType = params.get('token_type')

        if (accessToken && refreshToken) {
          // 構建 session object
          const session = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: parseInt(expiresIn || '3600'),
            token_type: tokenType || 'bearer',
            expires_at: Math.floor(Date.now() / 1000) + parseInt(expiresIn || '3600')
          }

          // 儲存到 localStorage (Supabase 格式)
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
          if (projectRef) {
            const storageKey = `sb-${projectRef}-auth-token`
            try {
              localStorage.setItem(storageKey, JSON.stringify(session))
              console.log('[Auth] Session stored to localStorage')
            } catch (e) {
              console.error('[Auth] Failed to store session:', e)
            }
          }

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
