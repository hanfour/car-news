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
      // 成功登入，重定向到首頁
      return NextResponse.redirect(`${origin}/?auth=success`)
    }
  }

  // 沒有 code 參數，可能是直接訪問
  return NextResponse.redirect(origin)
}
