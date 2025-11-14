import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin

  // 檢查 OAuth 錯誤
  if (error) {
    console.error('OAuth error:', { error, errorDescription })
    return NextResponse.redirect(
      `${origin}/?error=oauth_failed&message=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (code) {
    const supabase = createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Auth callback error:', exchangeError)
      return NextResponse.redirect(
        `${origin}/?error=auth_failed&message=${encodeURIComponent(exchangeError.message)}`
      )
    }

    if (data.session) {
      console.log('Auth successful:', data.user?.email)

      // 從 cookie 中讀取登入前的頁面路徑
      const returnUrl = request.cookies.get('auth_return_url')?.value

      // 成功登入後重定向回原頁面，或回首頁
      const redirectUrl = returnUrl ? `${origin}${returnUrl}?auth=success` : `${origin}/?auth=success`

      // 建立 response 並清除 return_url cookie
      const response = NextResponse.redirect(redirectUrl)
      response.cookies.delete('auth_return_url')

      return response
    }
  }

  // 沒有 code 參數，可能是直接訪問
  return NextResponse.redirect(origin)
}
