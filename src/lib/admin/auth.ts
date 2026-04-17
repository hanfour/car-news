import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'

/**
 * Timing-safe string comparison using Web Crypto API (Edge Runtime 兼容)
 * 防止 timing attack 洩漏 secret 長度/內容
 */
async function secureCompare(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const keyData = encoder.encode(a)
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig1 = await crypto.subtle.sign('HMAC', key, encoder.encode(a))
  const sig2 = await crypto.subtle.sign('HMAC', key, encoder.encode(b))
  const arr1 = new Uint8Array(sig1)
  const arr2 = new Uint8Array(sig2)
  if (arr1.length !== arr2.length) return false
  let result = 0
  for (let i = 0; i < arr1.length; i++) {
    result |= arr1[i] ^ arr2[i]
  }
  return result === 0
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
    if (await secureCompare(providedKey, ADMIN_API_KEY)) {
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
