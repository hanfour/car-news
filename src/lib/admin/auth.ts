import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'

/**
 * Debug API 訪問控制
 * 生產環境需要 admin 認證，開發環境允許訪問
 */
export async function verifyDebugAccess(request: NextRequest): Promise<{
  allowed: boolean
  response?: NextResponse
}> {
  // 開發環境允許訪問（但仍建議使用認證）
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true }
  }

  // 生產環境必須有 admin 認證
  const isAdmin = await verifyAdminAuth(request)
  if (!isAdmin) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Debug API disabled in production',
          hint: 'Login to /admin to obtain a session cookie before calling debug routes',
        },
        { status: 403 }
      ),
    }
  }

  return { allowed: true }
}

/**
 * Admin 認證 — 僅接受 web login 取得的 admin_session cookie。
 *
 * 歷史：原本還支援 Bearer ADMIN_API_KEY 給 Postman / curl 用，
 * 但靜態 long-lived secret 容易意外洩漏（曾在 git history 暴露 6 個月，
 * 詳見 PR #31 與其後的輪換 PR），因此整條路徑移除。
 *
 * 程式化呼叫請改走 web login → 複製 admin_session cookie → 帶入 request。
 */
export async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get('admin_session')
  if (!sessionCookie?.value) return false

  const userId = await verifySessionToken(sessionCookie.value)
  if (!userId) return false

  // Verify this userId is actually an admin
  const supabase = createServiceClient()
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single()

  return data?.is_admin === true
}
