import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifySessionToken } from '@/lib/admin/session'

export async function proxy(request: NextRequest) {
  // 保護 /admin 路徑
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const response = NextResponse.next()

    // 檢查是否有 admin session cookie
    const adminSession = request.cookies.get('admin_session')

    // 如果沒有 session 且不是登入頁面或 OAuth callback，重定向到登入
    const isLoginPage = request.nextUrl.pathname.startsWith('/admin/login')
    const isAuthCallback = request.nextUrl.pathname.startsWith('/admin/auth/callback')

    if (!adminSession && !isLoginPage && !isAuthCallback) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // 如果有 session，驗證用戶是否仍然是 admin
    if (adminSession && !request.nextUrl.pathname.startsWith('/admin/login')) {
      // 1. 驗證 session token
      const userId = await verifySessionToken(adminSession.value)

      if (!userId) {
        // Session 無效或已過期，清除 cookie 並重定向
        const response = NextResponse.redirect(new URL('/admin/login', request.url))
        response.cookies.delete('admin_session')
        return response
      }

      // 2. 驗證用戶仍然是 admin
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              )
            },
          },
        }
      )

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()

      if (!profile?.is_admin) {
        // 不再是 admin，清除 session 並重定向到登入
        const response = NextResponse.redirect(new URL('/admin/login', request.url))
        response.cookies.delete('admin_session')
        return response
      }
    }

    // 如果有 session 且在登入頁面，重定向到 dashboard
    if (adminSession && request.nextUrl.pathname === '/admin/login') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
