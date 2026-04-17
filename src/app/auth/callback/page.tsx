'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // 1. PKCE Flow — code 在 query params 中（Supabase JS v2 預設）
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          router.replace('/auth/error?reason=session_error')
          return
        }
        redirectToReturnUrl()
        return
      }

      // 2. Implicit Flow — tokens 在 hash fragment 中（相容舊版）
      const hash = window.location.hash
      if (hash && hash.length > 1) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          if (error) {
            router.replace('/auth/error?reason=session_error')
            return
          }
          redirectToReturnUrl()
          return
        } else {
          router.replace('/auth/error?reason=missing_tokens')
          return
        }
      }

      // 3. 無 code 也無 hash — 可能是 detectSessionInUrl 已自動處理
      //    等待 auth state change 再決定
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        redirectToReturnUrl()
      } else {
        router.replace('/')
      }
    }

    function redirectToReturnUrl() {
      const cookies = document.cookie.split(';')
      const returnUrlCookie = cookies.find(c => c.trim().startsWith('auth_return_url='))
      const returnUrl = returnUrlCookie
        ? decodeURIComponent(returnUrlCookie.split('=')[1])
        : '/'
      document.cookie = 'auth_return_url=; path=/; max-age=0'
      router.replace(returnUrl)
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
