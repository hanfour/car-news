import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin

  console.log('[OAuth Callback] Request URL:', request.url)
  console.log('[OAuth Callback] Code:', code ? 'present' : 'missing')
  console.log('[OAuth Callback] Error:', error)
  console.log('[OAuth Callback] Error description:', errorDescription)

  // Handle OAuth error from provider
  if (error) {
    console.error('[OAuth Callback] OAuth error from provider:', error, errorDescription)
    return NextResponse.redirect(`${origin}/admin/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`)
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
    const { data: { user }, error: authError } = await supabase.auth.exchangeCodeForSession(code)

    if (authError || !user) {
      console.error('[OAuth Callback] Auth error:', authError)
      return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      console.error('[OAuth Callback] Not an admin user:', user.id)
      // Sign out non-admin user
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/admin/login?error=not_admin`)
    }

    // Create admin session cookie
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ userId: user.id }),
    })

    if (!response.ok) {
      console.error('[OAuth Callback] Session creation failed')
      return NextResponse.redirect(`${origin}/admin/login?error=session_failed`)
    }

    // Get the session cookie from response
    const setCookieHeader = response.headers.get('set-cookie')
    const redirectResponse = NextResponse.redirect(`${origin}/admin`)

    // Forward the session cookie
    if (setCookieHeader) {
      redirectResponse.headers.set('set-cookie', setCookieHeader)
    }

    return redirectResponse
  }

  // No code provided
  return NextResponse.redirect(`${origin}/admin/login?error=no_code`)
}
