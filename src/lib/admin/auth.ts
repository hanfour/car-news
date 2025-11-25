import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'

/**
 * Unified admin authentication
 * Supports both Bearer token and session cookie
 */
export async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  // Method 1: Bearer token (for API calls)
  const authHeader = request.headers.get('authorization')
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY

  if (ADMIN_API_KEY && authHeader === `Bearer ${ADMIN_API_KEY}`) {
    return true
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
