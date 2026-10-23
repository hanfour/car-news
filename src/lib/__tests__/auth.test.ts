/**
 * @jest-environment node
 */

/**
 * createAuthenticatedClient 是所有「以使用者身分」API 的唯一入口，
 * admin login 的身分驗證也完全依賴它，因此鎖死其行為。
 */

jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ createServiceClient: jest.fn() }))

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

const mockedCookies = cookies as jest.Mock
const mockedServerClient = createServerClient as jest.Mock
const mockedCreateClient = createClient as jest.Mock

function requestWith(authorization?: string) {
  return new Request('http://localhost/api/anything', {
    headers: authorization ? { authorization } : {},
  })
}

function getUserReturns(result: { user: unknown; error: unknown }) {
  const getUser = jest.fn().mockResolvedValue({ data: { user: result.user }, error: result.error })
  mockedServerClient.mockReturnValue({ auth: { getUser } })
  return getUser
}

beforeEach(() => {
  jest.resetAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  mockedCookies.mockResolvedValue({ get: jest.fn(), set: jest.fn() })
})

describe('createAuthenticatedClient', () => {
  it('沒有 Authorization header 時回 null，且不向 Supabase 驗證', async () => {
    const getUser = getUserReturns({ user: { id: 'u1' }, error: null })

    expect(await createAuthenticatedClient(requestWith())).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('非 Bearer scheme 時回 null', async () => {
    const getUser = getUserReturns({ user: { id: 'u1' }, error: null })

    expect(await createAuthenticatedClient(requestWith('Basic abc'))).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('Supabase 回報 token 無效時回 null', async () => {
    getUserReturns({ user: null, error: { message: 'invalid JWT' } })

    expect(await createAuthenticatedClient(requestWith('Bearer forged'))).toBeNull()
  })

  it('Supabase 回傳沒有 user 時回 null', async () => {
    getUserReturns({ user: null, error: null })

    expect(await createAuthenticatedClient(requestWith('Bearer expired'))).toBeNull()
  })

  it('token 有效時回傳驗證出的 userId，並用該 JWT 建立受 RLS 約束的 client', async () => {
    const getUser = getUserReturns({ user: { id: 'u1', email: 'a@b.c' }, error: null })
    const rlsClient = { marker: 'rls-client' }
    mockedCreateClient.mockReturnValue(rlsClient)

    const result = await createAuthenticatedClient(requestWith('Bearer good-token'))

    expect(getUser).toHaveBeenCalledWith('good-token')
    expect(result?.userId).toBe('u1')
    expect(result?.user.email).toBe('a@b.c')
    expect(result?.supabase).toBe(rlsClient)
    // RLS client 必須是 anon key + 使用者 JWT，絕不能是 service role
    expect(mockedCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({ global: { headers: { Authorization: 'Bearer good-token' } } })
    )
  })

  it('getServiceClient 才會取得繞過 RLS 的 service client', async () => {
    getUserReturns({ user: { id: 'u1' }, error: null })
    mockedCreateClient.mockReturnValue({})
    const service = { marker: 'service-client' }
    ;(createServiceClient as jest.Mock).mockReturnValue(service)

    const result = await createAuthenticatedClient(requestWith('Bearer good-token'))

    expect(createServiceClient).not.toHaveBeenCalled()
    expect(result?.getServiceClient()).toBe(service)
  })
})
