/**
 * @jest-environment node
 */

/**
 * 回歸測試：login 的身分只能來自已驗證的 JWT，絕不採信 request body。
 */

jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/auth', () => ({ createAuthenticatedClient: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/lib/admin/session', () => ({ createAdminSession: jest.fn() }))
jest.mock('@/lib/admin/audit', () => ({ logAdminAction: jest.fn() }))
jest.mock('@/lib/admin/rate-limit', () => ({
  checkLoginRateLimit: jest.fn(),
  recordLoginAttempt: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAuthenticatedClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { createAdminSession } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/audit'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/admin/rate-limit'
import { POST } from '../route'

const VERIFIED_ID = '11111111-1111-1111-1111-111111111111'
const VICTIM_ADMIN_ID = '99999999-9999-9999-9999-999999999999'
const EMAIL = 'member@example.com'
const IP = '203.0.113.9'

const mockedAuth = createAuthenticatedClient as jest.Mock
const mockedServiceClient = createServiceClient as jest.Mock
const mockedCreateSession = createAdminSession as jest.Mock
const mockedRateLimit = checkLoginRateLimit as jest.Mock
const mockedRecordAttempt = recordLoginAttempt as jest.Mock
const mockedAudit = logAdminAction as jest.Mock
const mockedCookies = cookies as jest.Mock

const cookieSet = jest.fn()

/** userFields 預設帶 email；傳 {} 可模擬沒有 email 的帳號（不能用 undefined，會觸發預設值） */
function authedAs(userId: string, userFields: Record<string, unknown> = { email: EMAIL }) {
  mockedAuth.mockResolvedValue({
    userId,
    user: { id: userId, ...userFields },
    supabase: {},
    getServiceClient: jest.fn(),
  })
}

/** 模擬 service client 的 profiles.select('is_admin').eq('id', x).single() */
function profileLookup(result: { data: { is_admin: boolean } | null; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result)
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  mockedServiceClient.mockReturnValue({ from })
  return { from, select, eq, single }
}

function loginRequest(opts: { bearer?: string; body?: unknown } = {}) {
  return new NextRequest('http://localhost/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': IP,
      ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
}

beforeEach(() => {
  jest.resetAllMocks()
  mockedCookies.mockResolvedValue({ set: cookieSet })
  mockedRateLimit.mockResolvedValue({ allowed: true, remainingAttempts: 5 })
  mockedRecordAttempt.mockResolvedValue(true)
  mockedAudit.mockResolvedValue(true)
  mockedCreateSession.mockResolvedValue({
    token: 'session-token',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
  })
})

describe('POST /api/admin/auth/login', () => {
  describe('未通過身分驗證', () => {
    it('沒有可驗證的 token 時回 401，即使 body 填了真實 admin 的 userId', async () => {
      mockedAuth.mockResolvedValue(null)
      const lookup = profileLookup({ data: { is_admin: true }, error: null })

      const res = await POST(loginRequest({ body: { userId: VICTIM_ADMIN_ID } }))

      expect(res.status).toBe(401)
      expect(lookup.from).not.toHaveBeenCalled()
      expect(mockedServiceClient).not.toHaveBeenCalled()
      expect(mockedCreateSession).not.toHaveBeenCalled()
      expect(cookieSet).not.toHaveBeenCalled()
    })

    it('token 無效（驗證回 null）時回 401 且不發 cookie', async () => {
      mockedAuth.mockResolvedValue(null)

      const res = await POST(loginRequest({ bearer: 'forged', body: { userId: VICTIM_ADMIN_ID } }))

      expect(res.status).toBe(401)
      expect(mockedCreateSession).not.toHaveBeenCalled()
      expect(cookieSet).not.toHaveBeenCalled()
    })
  })

  describe('已驗證身分', () => {
    it('只使用 JWT 驗證出的 user id，忽略 body 的 userId', async () => {
      authedAs(VERIFIED_ID)
      const lookup = profileLookup({ data: { is_admin: true }, error: null })

      const res = await POST(loginRequest({ bearer: 'good', body: { userId: VICTIM_ADMIN_ID } }))

      expect(res.status).toBe(200)
      expect(lookup.eq).toHaveBeenCalledWith('id', VERIFIED_ID)
      expect(lookup.eq).not.toHaveBeenCalledWith('id', VICTIM_ADMIN_ID)
      expect(mockedCreateSession.mock.calls[0][0]).toBe(VERIFIED_ID)
      expect(mockedAudit.mock.calls[0][0]).toMatchObject({
        userId: VERIFIED_ID,
        userEmail: EMAIL,
        action: 'login',
      })
    })

    it('成功時設置 HttpOnly 的 admin_session cookie 並記錄成功登入', async () => {
      authedAs(VERIFIED_ID)
      profileLookup({ data: { is_admin: true }, error: null })

      const res = await POST(loginRequest({ bearer: 'good' }))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(cookieSet).toHaveBeenCalledWith(
        'admin_session',
        'session-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
      )
      expect(mockedRecordAttempt).toHaveBeenCalledWith(EMAIL, true, IP)
    })

    it('身分有效但不是 admin 時回 403，不建立 session', async () => {
      authedAs(VERIFIED_ID)
      profileLookup({ data: { is_admin: false }, error: null })

      const res = await POST(loginRequest({ bearer: 'good' }))

      expect(res.status).toBe(403)
      expect(mockedCreateSession).not.toHaveBeenCalled()
      expect(cookieSet).not.toHaveBeenCalled()
    })

    it('查不到 profile（查詢錯誤）時回 403', async () => {
      authedAs(VERIFIED_ID)
      profileLookup({ data: null, error: { message: 'not found' } })

      const res = await POST(loginRequest({ bearer: 'good' }))

      expect(res.status).toBe(403)
      expect(mockedCreateSession).not.toHaveBeenCalled()
    })

    it('已驗證的 user 沒有 email 時回 404', async () => {
      authedAs(VERIFIED_ID, {})
      profileLookup({ data: { is_admin: true }, error: null })

      const res = await POST(loginRequest({ bearer: 'good' }))

      expect(res.status).toBe(404)
      expect(mockedCreateSession).not.toHaveBeenCalled()
    })

    it('超過失敗次數限制時回 429 並記錄', async () => {
      authedAs(VERIFIED_ID)
      profileLookup({ data: { is_admin: true }, error: null })
      mockedRateLimit.mockResolvedValue({ allowed: false, remainingAttempts: 0 })

      const res = await POST(loginRequest({ bearer: 'good' }))

      expect(res.status).toBe(429)
      expect(mockedRecordAttempt).toHaveBeenCalledWith(EMAIL, false, IP, 'Rate limit exceeded')
      expect(mockedCreateSession).not.toHaveBeenCalled()
      expect(cookieSet).not.toHaveBeenCalled()
    })

    it('建立 session 失敗時回 500，不發 cookie', async () => {
      authedAs(VERIFIED_ID)
      profileLookup({ data: { is_admin: true }, error: null })
      mockedCreateSession.mockResolvedValue(null)

      const res = await POST(loginRequest({ bearer: 'good' }))

      expect(res.status).toBe(500)
      expect(mockedRecordAttempt).toHaveBeenCalledWith(EMAIL, false, IP, 'Session creation failed')
      expect(cookieSet).not.toHaveBeenCalled()
    })

    it('內部拋錯時回 500 而不是洩漏細節', async () => {
      mockedAuth.mockRejectedValue(new Error('boom: secret detail'))

      const res = await POST(loginRequest({ bearer: 'good' }))
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(JSON.stringify(json)).not.toContain('secret detail')
    })
  })
})
