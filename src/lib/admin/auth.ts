import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { timingSafeEqual } from 'crypto'

/**
 * Timing-safe string comparison to prevent timing attacks on secret comparison
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

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
          hint: 'Use admin authentication or run in development mode'
        },
        { status: 403 }
      )
    }
  }

  return { allowed: true }
}

/**
 * Unified admin authentication
 * Supports both Bearer token and session cookie
 */
export async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  // Method 1: Bearer token (for API calls)
  const authHeader = request.headers.get('authorization')
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY

  if (ADMIN_API_KEY && authHeader?.startsWith('Bearer ')) {
    const providedKey = authHeader.slice(7)
    if (secureCompare(providedKey, ADMIN_API_KEY)) {
      return true
    }
  }

  // Method 2: Cookie session (for Web UI)
  const sessionCookie = request.cookies.get('admin_session')
  if (sessionCookie?.value) {
    // Verify session token and get userId
    const userId = await verifySessionToken(sessionCookie.value)
    if (!userId) {
      return false
    }

    // Verify this userId is actually an admin
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    return data?.is_admin === true
  }

  return false
}
