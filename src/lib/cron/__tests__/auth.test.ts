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

  it('rejects requests with no auth header', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    expect(await verifyCronAuth(mockRequest({}))).toBe(false)
  })

  it('rejects when CRON_SECRET env 不存在，即使送 Bearer', async () => {
    delete process.env.CRON_SECRET
    const req = mockRequest({ authorization: 'Bearer anything' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('x-vercel-cron: 1 不是身分證明：在 Vercel 上也拒絕', async () => {
    process.env.VERCEL = '1'
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ 'x-vercel-cron': '1' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('x-vercel-cron: 1 不是身分證明：非 Vercel 環境同樣拒絕', async () => {
    delete process.env.VERCEL
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ 'x-vercel-cron': '1' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('x-vercel-cron-schedule 這類排程相關標頭也不能取代密碼', async () => {
    process.env.VERCEL = '1'
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({
      'x-vercel-cron-schedule': '0 * * * *',
      'user-agent': 'vercel-cron/1.0',
    })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('帶了排程標頭但密碼錯誤 → 拒絕', async () => {
    process.env.VERCEL = '1'
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ 'x-vercel-cron': '1', authorization: 'Bearer not-it' })
    expect(await verifyCronAuth(req)).toBe(false)
  })

  it('在 Vercel 上，正確的 Bearer 仍然通過（排程器自動帶的就是這個）', async () => {
    process.env.VERCEL = '1'
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ authorization: 'Bearer the-real-secret' })
    expect(await verifyCronAuth(req)).toBe(true)
  })

  it('non-Bearer authorization schemes are rejected', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const req = mockRequest({ authorization: 'Basic dXNlcjpwYXNz' })
    expect(await verifyCronAuth(req)).toBe(false)
  })
})

describe('verifyBearerSecret', () => {
  it('accepts Bearer matching CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'cron-secret-value'
    const req = mockRequest({ authorization: 'Bearer cron-secret-value' })
    expect(await verifyBearerSecret(req, 'CRON_SECRET')).toBe(true)
  })

  it('rejects mismatched Bearer for CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'cron-secret-value'
    const req = mockRequest({ authorization: 'Bearer wrong' })
    expect(await verifyBearerSecret(req, 'CRON_SECRET')).toBe(false)
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
