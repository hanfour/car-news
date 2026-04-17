import { createServiceClient } from '@/lib/supabase'

/**
 * 生成安全的 session token
 * 使用 Web Crypto API (Edge Runtime 兼容)
 */
export function generateSessionToken(): string {
  // 使用 Web Crypto API 而非 Node.js crypto (Edge Runtime 兼容)
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * 創建 Admin Session
 */
export async function createAdminSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date } | null> {
  const supabase = createServiceClient()

  // 生成 session token
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 天

  const { data, error } = await supabase
    .from('admin_sessions')
    .insert({
      user_id: userId,
      token,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[Admin Session] Failed to create session:', error)
    return null
  }

  return { token, expiresAt }
}

// 閒置超時：2 小時無活動自動失效
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000

/**
 * 驗證 Session Token 並返回 User ID
 * 同時檢查閒置超時（2 小時）和絕對過期（7 天）
 */
export async function verifySessionToken(token: string): Promise<string | null> {
  const supabase = createServiceClient()

  // 查詢有效的 session（包含 last_activity_at 用於閒置檢查）
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('user_id, expires_at, last_activity_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return null
  }

  // 檢查閒置超時
  if (data.last_activity_at) {
    const lastActivity = new Date(data.last_activity_at).getTime()
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
      // 閒置過久，刪除 session
      await supabase.from('admin_sessions').delete().eq('token', token)
      return null
    }
  }

  // 更新最後活動時間
  await supabase
    .from('admin_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('token', token)

  return data.user_id
}

/**
 * 撤銷 Session (登出)
 */
export async function revokeSession(token: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('admin_sessions')
    .delete()
    .eq('token', token)

  return !error
}

/**
 * 撤銷用戶的所有 Sessions (強制登出所有設備)
 */
export async function revokeAllUserSessions(userId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('admin_sessions')
    .delete()
    .eq('user_id', userId)

  return !error
}

/**
 * 清理過期的 Sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('[Admin Session] Failed to cleanup:', error)
    return 0
  }

  return data?.length || 0
}
