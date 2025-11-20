import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase'
import { createAdminSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/admin/rate-limit'
import { getClientIp, getUserAgent } from '@/lib/admin/utils'

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // 1. 驗證用戶確實是 admin
    const supabase = createServiceClient()
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin, email')
      .eq('id', userId)
      .single()

    if (error || !profile?.is_admin) {
      // 記錄失敗的登入嘗試
      if (profile?.email) {
        await recordLoginAttempt(
          profile.email,
          false,
          ipAddress,
          'Not an admin user'
        )
      }

      return NextResponse.json({ error: 'Not an admin user' }, { status: 403 })
    }

    const userEmail = profile.email

    // 2. 檢查 Rate Limiting
    const rateLimit = await checkLoginRateLimit(userEmail, ipAddress)
    if (!rateLimit.allowed) {
      await recordLoginAttempt(userEmail, false, ipAddress, 'Rate limit exceeded')

      return NextResponse.json(
        {
          error: 'Too many failed login attempts',
          remainingAttempts: rateLimit.remainingAttempts,
          resetAt: rateLimit.resetAt,
        },
        { status: 429 }
      )
    }

    // 3. 創建 Admin Session
    const session = await createAdminSession(userId, ipAddress, userAgent)
    if (!session) {
      await recordLoginAttempt(userEmail, false, ipAddress, 'Session creation failed')

      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // 4. 設置 HttpOnly Cookie
    const cookieStore = await cookies()
    cookieStore.set('admin_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // 5. 記錄成功的登入
    await recordLoginAttempt(userEmail, true, ipAddress)

    // 6. 記錄到審計日誌
    await logAdminAction({
      userId,
      userEmail,
      action: 'login',
      ipAddress,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error('[Admin Login] Error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
