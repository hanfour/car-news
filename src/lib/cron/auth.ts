import { NextRequest, NextResponse } from 'next/server'
import { secureCompare } from '@/lib/utils/secure-compare'

/**
 * Verify a cron request.
 *
 * 只認 Vercel 官方文件記載的方式：`Authorization: Bearer ${CRON_SECRET}`（timing-safe 比對）。
 * 專案設定了 CRON_SECRET 之後，Vercel 排程器會自動帶上它；手動觸發也用同一種方式。
 *
 * 過去這裡還額外接受任何帶 `x-vercel-cron: 1` 標頭的請求。該標頭不在官方文件中，
 * 文件也沒有說明外部請求會被剝除，不能當作身分證明，所以已移除。
 * 請勿再加回任何「只看某個標頭」的放行路徑。
 */
export async function verifyCronAuth(request: NextRequest): Promise<boolean> {
  return verifyBearerSecret(request, 'CRON_SECRET')
}

/**
 * Verify a bearer token against a given env-var name using timing-safe comparison.
 * 目前只用於 CRON_SECRET 變體（migrate routes、手動觸發 cron）。
 * 歷史上也支援 ADMIN_API_KEY，後者已隨「移除靜態 admin key」PR 移除。
 */
export async function verifyBearerSecret(
  request: NextRequest,
  envVarName: 'CRON_SECRET'
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
