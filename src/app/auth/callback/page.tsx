'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [processed, setProcessed] = useState(false)

  useEffect(() => {
    // 防止重複執行
    if (processed) return

    const handleCallback = async () => {
      try {
        setProcessed(true)

        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // 檢查 URL hash 中的 error
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const errorCode = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        if (errorCode) {
          console.error('OAuth error:', { errorCode, errorDescription })
          setError(errorDescription || errorCode)
          setTimeout(() => {
            router.push(`/?error=oauth_failed&message=${encodeURIComponent(errorDescription || errorCode)}`)
          }, 2000)
          return
        }

        // Supabase 會自動處理 hash fragment 中的 token
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setError(sessionError.message)
          setTimeout(() => {
            router.push(`/?error=auth_failed&message=${encodeURIComponent(sessionError.message)}`)
          }, 2000)
          return
        }

        if (data.session) {
          console.log('Auth successful:', data.session.user.email)

          // 讀取登入前的頁面路徑
          const cookies = document.cookie.split(';')
          const returnUrlCookie = cookies.find(c => c.trim().startsWith('auth_return_url='))
          const returnUrl = returnUrlCookie
            ? decodeURIComponent(returnUrlCookie.split('=')[1])
            : '/'

          // 清除 cookie
          document.cookie = 'auth_return_url=; path=/; max-age=0'

          // 重定向回原頁面
          const redirectUrl = returnUrl !== '/' ? `${returnUrl}?auth=success` : '/?auth=success'
          router.push(redirectUrl)
        } else {
          // 沒有 session，可能是直接訪問
          router.push('/')
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('認證過程發生錯誤')
        setTimeout(() => {
          router.push('/?error=auth_failed')
        }, 2000)
      }
    }

    handleCallback()
  }, [router, processed])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">登入失敗</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">即將返回首頁...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">登入中...</h2>
            <p className="text-gray-600">請稍候，正在完成認證</p>
          </>
        )}
      </div>
    </div>
  )
}
