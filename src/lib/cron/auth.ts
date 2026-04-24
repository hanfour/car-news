import { NextRequest, NextResponse } from 'next/server'
import { secureCompare } from '@/lib/utils/secure-compare'

/**
 * Verify a cron request. Accepts either:
 *   - Vercel Cron invocation (x-vercel-cron: 1, stripped by Vercel edge from external requests)
 *   - Manual trigger with Bearer CRON_SECRET (timing-safe compared)
 */
export async function verifyCronAuth(request: NextRequest): Promise<boolean> {
  if (request.headers.get('x-vercel-cron') === '1') return true

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
