import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeSession, verifySessionToken } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import { getClientIp, getUserAgent } from '@/lib/admin/utils'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  try {
    // 1. 獲取 session token
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('admin_session')

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 })
    }

    const token = sessionCookie.value

    // 2. 獲取用戶信息 (用於 audit log)
    const userId = await verifySessionToken(token)

    if (userId) {
      // 獲取用戶 email
      const supabase = createServiceClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()

      // 記錄登出操作
      if (profile?.email) {
        await logAdminAction({
          userId,
          userEmail: profile.email,
          action: 'logout',
          ipAddress,
          userAgent,
        })
      }
    }

    // 3. 撤銷 session
    await revokeSession(token)

    // 4. 清除 cookie
    cookieStore.delete('admin_session')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Logout] Error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
