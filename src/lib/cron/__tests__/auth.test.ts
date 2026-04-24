/**
 * @jest-environment node
 */
import { verifyCronAuth, verifyBearerSecret } from '../auth'

type HeaderMap = Record<string, string>

// Minimal NextRequest stub — just the headers.get + authorization interface we touch.
// 避免起真的 Next.js request pipeline 只為了測驗證邏輯。
function mockRequest(headers: HeaderMap = {}) {
  const lower: HeaderMap = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  )
  return {
    headers: {
      get: (name: string) => lower[name.toLowerCase()] ?? null,
    },
  } as unknown as Parameters<typeof verifyCronAuth>[0]
}

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('verifyCronAuth', () => {
  it('accepts a correct Bearer CRON_SECRET (timing-safe)', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ authorization: 'Bearer the-real-secret' })
    expect(await verifyCronAuth(req)).toBe(true)
  })

  it('rejects an incorrect Bearer', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ authorization: 'Bearer not-it' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('rejects requests with no auth header and no x-vercel-cron', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    expect(await verifyCronAuth(mockRequest({}))).toBe(false)
  })

  it('rejects when CRON_SECRET env 不存在，即使送 Bearer', async () => {
    delete process.env.CRON_SECRET
    const req = mockRequest({ authorization: 'Bearer anything' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('accepts x-vercel-cron:1 only when VERCEL=1 env 存在', async () => {
    process.env.VERCEL = '1'
    const req = mockRequest({ 'x-vercel-cron': '1' })
    expect(await verifyCronAuth(req)).toBe(true)
  })

  it('rejects spoofed x-vercel-cron when VERCEL env 不存在（local / 非 Vercel 環境）', async () => {
    delete process.env.VERCEL
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ 'x-vercel-cron': '1' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('non-Bearer authorization schemes are rejected', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ authorization: 'Basic dXNlcjpwYXNz' })
    expect(await verifyCronAuth(req)).toBe(false)
  })
})

describe('verifyBearerSecret', () => {
  it('accepts Bearer matching named env var', async () => {
    process.env.ADMIN_API_KEY = 'admin-key'
    const req = mockRequest({ authorization: 'Bearer admin-key' })
    expect(await verifyBearerSecret(req, 'ADMIN_API_KEY')).toBe(true)
  })

  it('rejects mismatched Bearer for named env var', async () => {
    process.env.ADMIN_API_KEY = 'admin-key'
    const req = mockRequest({ authorization: 'Bearer wrong' })
    expect(await verifyBearerSecret(req, 'ADMIN_API_KEY')).toBe(false)
  })

  it('rejects when env var is absent', async () => {
    delete process.env.CRON_SECRET
    const req = mockRequest({ authorization: 'Bearer anything' })
    expect(await verifyBearerSecret(req, 'CRON_SECRET')).toBe(false)
  })

  it('accepts both Authorization header capitalizations', async () => {
    process.env.CRON_SECRET = 'abc'
    expect(
      await verifyBearerSecret(mockRequest({ Authorization: 'Bearer abc' }), 'CRON_SECRET')
    ).toBe(true)
    expect(
      await verifyBearerSecret(mockRequest({ authorization: 'Bearer abc' }), 'CRON_SECRET')
    ).toBe(true)
  })
})
