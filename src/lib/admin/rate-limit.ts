import { createServiceClient } from '@/lib/supabase'

/**
 * 記錄登入嘗試
 */
export async function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress?: string,
  errorMessage?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase.from('admin_login_attempts').insert({
    email,
    success,
    ip_address: ipAddress,
    error_message: errorMessage,
  })

  if (error) {
    console.error('[Rate Limit] Failed to record login attempt:', error)
    return false
  }

  return true
}

/**
 * 檢查是否超過登入失敗次數限制
 * 規則: 15 分鐘內失敗 5 次則鎖定
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress?: string
): Promise<{ allowed: boolean; remainingAttempts: number; resetAt?: Date }> {
  const supabase = createServiceClient()

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  // 查詢過去 15 分鐘的失敗次數
  let query = supabase
    .from('admin_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('success', false)
    .gte('created_at', fifteenMinutesAgo)

  // 檢查 email 或 IP
  if (ipAddress) {
    query = query.or(`email.eq.${email},ip_address.eq.${ipAddress}`)
  } else {
    query = query.eq('email', email)
  }

  const { count, error } = await query

  if (error) {
    console.error('[Rate Limit] Failed to check rate limit:', error)
    // 出錯時保守處理,允許登入
    return { allowed: true, remainingAttempts: 5 }
  }

  const failedCount = count || 0
  const maxAttempts = 5
  const remainingAttempts = Math.max(0, maxAttempts - failedCount)
  const allowed = failedCount < maxAttempts

  return {
    allowed,
    remainingAttempts,
    resetAt: allowed ? undefined : new Date(Date.now() + 15 * 60 * 1000),
  }
}

/**
 * 重置登入失敗計數 (登入成功後調用)
 */
export async function resetLoginAttempts(email: string): Promise<void> {
  // 不需要實際刪除記錄,checkLoginRateLimit 只查詢過去 15 分鐘的記錄
  // 如果需要立即重置,可以刪除舊記錄:

  // const supabase = createServiceClient()
  // await supabase
  //   .from('admin_login_attempts')
  //   .delete()
  //   .eq('email', email)
}

/**
 * 清理舊的登入記錄 (保留 30 天)
 */
export async function cleanupOldLoginAttempts(): Promise<number> {
  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('admin_login_attempts')
    .delete()
    .lt('created_at', thirtyDaysAgo)
    .select('id')

  if (error) {
    console.error('[Rate Limit] Failed to cleanup:', error)
    return 0
  }

  return data?.length || 0
}

/**
 * 獲取登入統計
 */
export async function getLoginStats(days: number = 7) {
  const supabase = createServiceClient()

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('admin_login_attempts')
    .select('success, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Rate Limit] Failed to get stats:', error)
    return { total: 0, success: 0, failed: 0 }
  }

  const total = data?.length || 0
  const success = data?.filter((item) => item.success).length || 0
  const failed = total - success

  return { total, success, failed }
}
