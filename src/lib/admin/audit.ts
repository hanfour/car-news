import { createServiceClient } from '@/lib/supabase'

export type AdminAction =
  | 'login'
  | 'logout'
  | 'update_article'
  | 'delete_article'
  | 'publish_article'
  | 'unpublish_article'
  | 'create_user'
  | 'update_user'
  | 'delete_user'

export interface AuditLogEntry {
  userId: string
  userEmail: string
  action: AdminAction
  resourceType?: string
  resourceId?: string
  changes?: {
    before?: any
    after?: any
  }
  ipAddress?: string
  userAgent?: string
}

/**
 * 記錄管理員操作到審計日誌
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase.from('admin_audit_log').insert({
    user_id: entry.userId,
    user_email: entry.userEmail,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    changes: entry.changes ? JSON.stringify(entry.changes) : null,
    ip_address: entry.ipAddress,
    user_agent: entry.userAgent,
  })

  if (error) {
    console.error('[Audit Log] Failed to log action:', error)
    return false
  }

  return true
}

/**
 * 查詢審計日誌
 */
export async function getAuditLogs(options?: {
  userId?: string
  action?: AdminAction
  resourceType?: string
  resourceId?: string
  limit?: number
  offset?: number
}) {
  const supabase = createServiceClient()

  let query = supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.userId) {
    query = query.eq('user_id', options.userId)
  }

  if (options?.action) {
    query = query.eq('action', options.action)
  }

  if (options?.resourceType) {
    query = query.eq('resource_type', options.resourceType)
  }

  if (options?.resourceId) {
    query = query.eq('resource_id', options.resourceId)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Audit Log] Failed to fetch logs:', error)
    return []
  }

  return data || []
}

/**
 * 獲取特定資源的操作歷史
 */
export async function getResourceHistory(
  resourceType: string,
  resourceId: string,
  limit: number = 50
) {
  return getAuditLogs({ resourceType, resourceId, limit })
}
