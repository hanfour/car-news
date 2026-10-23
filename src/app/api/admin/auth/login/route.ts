import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { createAdminSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/admin/rate-limit'
import { getClientIp, getUserAgent } from '@/lib/admin/utils'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/auth/login — 以 Supabase access token 換取 admin session cookie。
 *
 * 身分只來自 `Authorization: Bearer <access_token>`，由 Supabase Auth 伺服器驗證後
 * 取得 user。**絕對不可信任 request body 內的 userId**：client 可任意填寫。
 */
export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    // 1. 驗證呼叫者身分。request body 一律忽略。
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      logger.warn('api.admin.login_unauthenticated', { ipAddress })
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { userId, user } = auth

    // 2. 驗證用戶確實是 admin
    const supabase = createServiceClient()
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (error || !profile?.is_admin) {
      return NextResponse.json({ error: 'Not an admin user' }, { status: 403 })
    }

    // 3. email 取自已驗證的 user
    const userEmail = user.email
    if (!userEmail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 4. 檢查 Rate Limiting
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

    // 5. 創建 Admin Session
    const session = await createAdminSession(userId, ipAddress, userAgent)
    if (!session) {
      await recordLoginAttempt(userEmail, false, ipAddress, 'Session creation failed')

      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // 6. 設置 HttpOnly Cookie
    const cookieStore = await cookies()
    cookieStore.set('admin_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // 7. 記錄成功的登入
    await recordLoginAttempt(userEmail, true, ipAddress)

    // 8. 記錄到審計日誌
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
    logger.error('api.admin.login_fail', error, { ipAddress })
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
