import { NextRequest, NextResponse } from 'next/server'
import { secureCompare } from '@/lib/utils/secure-compare'

/**
 * Verify a cron request. Accepts either:
 *   - Vercel Cron invocation: `x-vercel-cron: 1` AND 正在 Vercel 環境跑 (process.env.VERCEL)
 *     Vercel Edge 會自動從外部請求剝除此 header，但僅在實際跑在 Vercel 上這保證才成立；
 *     若不加 `VERCEL` 檢查，local / 自架 proxy 可能讓此 header 被偽造。
 *   - Manual trigger: Bearer CRON_SECRET (timing-safe compared)
 */
export async function verifyCronAuth(request: NextRequest): Promise<boolean> {
  const onVercel = process.env.VERCEL === '1'
  if (onVercel && request.headers.get('x-vercel-cron') === '1') {
    return true
  }

  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const provided = authHeader.slice(7)
  return secureCompare(provided, secret)
}

/**
 * Verify a bearer token against a given env-var name using timing-safe comparison.
 * For admin / migrate endpoints that share the CRON_SECRET or ADMIN_API_KEY pattern.
 */
export async function verifyBearerSecret(
  request: NextRequest,
  envVarName: 'CRON_SECRET' | 'ADMIN_API_KEY'
): Promise<boolean> {
  const secret = process.env[envVarName]?.trim()
  if (!secret) return false

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const provided = authHeader.slice(7)
  return secureCompare(provided, secret)
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
