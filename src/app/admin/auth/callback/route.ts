import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminSession } from '@/lib/admin/session'
import { logger } from '@/lib/logger'

// 注意：此處刻意不記錄 request.url（含一次性 OAuth code）、使用者 email 與 profile 內容。
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin

  // Handle OAuth error from provider
  if (error) {
    logger.warn('admin.oauth_callback.provider_error', { error, errorDescription })
    return NextResponse.redirect(
      `${origin}/admin/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    // Exchange code for session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.exchangeCodeForSession(code)

    if (authError || !user) {
      logger.error('admin.oauth_callback.auth_failed', authError)
      return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      logger.warn('admin.oauth_callback.not_admin', { userId: user.id })
      // Sign out non-admin user
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/admin/login?error=not_admin`)
    }

    // Create admin session directly
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const session = await createAdminSession(user.id, ipAddress, userAgent)

    if (!session) {
      logger.error('admin.oauth_callback.session_failed', undefined, { userId: user.id })
      return NextResponse.redirect(`${origin}/admin/login?error=session_failed`)
    }

    // Set the session cookie directly and redirect
    cookieStore.set('admin_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return NextResponse.redirect(`${origin}/admin`)
  }

  // No code provided
  return NextResponse.redirect(`${origin}/admin/login?error=no_code`)
}
