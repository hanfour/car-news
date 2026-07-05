/**
 * @jest-environment node
 */
import { verifyAdminAuth } from '../auth'
import { verifySessionToken } from '../session'
import { createServiceClient } from '@/lib/supabase'

jest.mock('../session', () => ({
  verifySessionToken: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({
  createServiceClient: jest.fn(),
}))

const mockVerifySessionToken = verifySessionToken as jest.MockedFunction<typeof verifySessionToken>
const mockCreateServiceClient = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>

type Cookies = Record<string, string>
type Headers = Record<string, string>

// 只 stub verifyAdminAuth 實際會碰的 cookies.get / headers.get 介面。
function mockRequest(cookies: Cookies = {}, headers: Headers = {}) {
  const lowerHeaders: Headers = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  )
  return {
    cookies: {
      get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined),
    },
    headers: {
      get: (name: string) => lowerHeaders[name.toLowerCase()] ?? null,
    },
  } as unknown as Parameters<typeof verifyAdminAuth>[0]
}

// createServiceClient().from().select().eq().single() → { data }
function mockProfileLookup(data: { is_admin: boolean } | null) {
  const single = jest.fn().mockResolvedValue({ data })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  mockCreateServiceClient.mockReturnValue({ from } as unknown as ReturnType<
    typeof createServiceClient
  >)
  return { from, select, eq, single }
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('verifyAdminAuth', () => {
  it('rejects when there is no admin_session cookie', async () => {
    const req = mockRequest({})
    expect(await verifyAdminAuth(req)).toBe(false)
    expect(mockVerifySessionToken).not.toHaveBeenCalled()
  })

  it('rejects when the session token is invalid/expired', async () => {
    mockVerifySessionToken.mockResolvedValue(null)
    const req = mockRequest({ admin_session: 'stale-token' })
    expect(await verifyAdminAuth(req)).toBe(false)
  })

  it('rejects a valid session whose profile is not admin', async () => {
    mockVerifySessionToken.mockResolvedValue('user-123')
    mockProfileLookup({ is_admin: false })
    const req = mockRequest({ admin_session: 'good-token' })
    expect(await verifyAdminAuth(req)).toBe(false)
  })

  it('rejects when the profile row is missing', async () => {
    mockVerifySessionToken.mockResolvedValue('user-123')
    mockProfileLookup(null)
    const req = mockRequest({ admin_session: 'good-token' })
    expect(await verifyAdminAuth(req)).toBe(false)
  })

  it('accepts a valid session belonging to an admin', async () => {
    mockVerifySessionToken.mockResolvedValue('user-123')
    mockProfileLookup({ is_admin: true })
    const req = mockRequest({ admin_session: 'good-token' })
    expect(await verifyAdminAuth(req)).toBe(true)
  })

  // 回歸：S2 — 淘汰的 Bearer ADMIN_API_KEY 路徑絕不能復活。
  it('ignores Authorization: Bearer undefined when no cookie is present', async () => {
    const req = mockRequest({}, { authorization: 'Bearer undefined' })
    expect(await verifyAdminAuth(req)).toBe(false)
  })

  it('ignores any Bearer header — auth is decided solely by the admin cookie', async () => {
    // 帶著看似有效的 Bearer,但沒有 cookie → 仍必須拒絕
    const req = mockRequest({}, { authorization: 'Bearer some-leaked-static-key' })
    expect(await verifyAdminAuth(req)).toBe(false)
    expect(mockVerifySessionToken).not.toHaveBeenCalled()
  })
})
