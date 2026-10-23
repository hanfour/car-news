/**
 * @jest-environment node
 */

/**
 * 回歸測試：刪除車庫圖片時，只能刪到「此使用者、此車輛」自己上傳的 R2 物件。
 * DB 內的圖片 URL 是使用者可寫入的字串，type 參數也由 client 決定，兩者都不能被信任。
 */

jest.mock('@/lib/auth', () => ({ createAuthenticatedClient: jest.fn() }))
jest.mock('@/lib/storage/r2-client', () => ({ uploadToR2: jest.fn(), deleteFromR2: jest.fn() }))

import { NextRequest } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { deleteFromR2 } from '@/lib/storage/r2-client'
import { DELETE } from '../route'

const BASE = 'https://cdn.example.com'
const USER = '11111111-1111-1111-1111-111111111111'
const CAR = 'c1111111-1111-1111-1111-111111111111'
const OWN_KEY = `garage/${USER}/${CAR}/1700000000000.webp`
const OWN_URL = `${BASE}/${OWN_KEY}`
const ARTICLE_COVER_URL = `${BASE}/custom-abc1234-1700000000000.webp`
const OTHER_USER_URL = `${BASE}/garage/99999999-9999-9999-9999-999999999999/${CAR}/1.webp`

const mockedAuth = createAuthenticatedClient as jest.Mock
const mockedDeleteFromR2 = deleteFromR2 as jest.Mock

interface Car {
  id: string
  cover_image: string | null
  images: string[]
}
interface Chain {
  select: () => Chain
  eq: () => Chain
  single: () => Promise<{ data: Car | null; error: { message: string } | null }>
  update: (patch: Record<string, unknown>) => Chain
  then: (resolve: (v: { error: null }) => void) => void
}

function fakeSupabase(car: Car | null) {
  const updates: Record<string, unknown>[] = []
  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: car, error: car ? null : { message: 'not found' } }),
    update: (patch) => {
      updates.push(patch)
      return chain
    },
    then: (resolve) => resolve({ error: null }),
  }
  return { client: { from: () => chain }, updates }
}

function signedInWith(car: Car | null) {
  const db = fakeSupabase(car)
  mockedAuth.mockResolvedValue({ supabase: db.client, userId: USER })
  return db
}

function deleteRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/garage/${CAR}/images`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
}

const call = (body: unknown) =>
  DELETE(deleteRequest(body), { params: Promise.resolve({ id: CAR }) })

beforeEach(() => {
  jest.resetAllMocks()
  mockedDeleteFromR2.mockResolvedValue(undefined)
  process.env.R2_PUBLIC_URL = BASE
})

describe('DELETE /api/garage/[id]/images', () => {
  it('未登入回 401', async () => {
    mockedAuth.mockResolvedValue(null)

    const res = await call({ url: OWN_URL, type: 'gallery' })

    expect(res.status).toBe(401)
    expect(mockedDeleteFromR2).not.toHaveBeenCalled()
  })

  it('刪除自己相簿裡的圖片：更新 DB 並刪除對應的 R2 物件', async () => {
    const db = signedInWith({ id: CAR, cover_image: null, images: [OWN_URL] })

    const res = await call({ url: OWN_URL, type: 'gallery' })

    expect(res.status).toBe(200)
    expect(db.updates[0]).toMatchObject({ images: [] })
    expect(mockedDeleteFromR2).toHaveBeenCalledWith(OWN_KEY)
  })

  it('刪除自己的封面圖', async () => {
    const db = signedInWith({ id: CAR, cover_image: OWN_URL, images: [] })

    const res = await call({ url: OWN_URL, type: 'cover' })

    expect(res.status).toBe(200)
    expect(db.updates[0]).toMatchObject({ cover_image: null })
    expect(mockedDeleteFromR2).toHaveBeenCalledWith(OWN_KEY)
  })

  it.each([['x'], ['other'], ['']])(
    'type 不是 cover / gallery（%p）時一律拒絕，不碰 DB 也不刪 R2',
    async (type) => {
      const db = signedInWith({ id: CAR, cover_image: null, images: [OWN_URL] })

      const res = await call({ url: ARTICLE_COVER_URL, type })

      expect(res.status).toBe(400)
      expect(db.updates).toHaveLength(0)
      expect(mockedDeleteFromR2).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['文章封面', ARTICLE_COVER_URL],
    ['其他使用者的車庫圖', OTHER_USER_URL],
  ])('相簿被寫入「%s」的網址時，只移除引用，不刪 R2 物件', async (_label, foreignUrl) => {
    const db = signedInWith({ id: CAR, cover_image: null, images: [foreignUrl] })

    const res = await call({ url: foreignUrl, type: 'gallery' })

    expect(res.status).toBe(200)
    expect(db.updates[0]).toMatchObject({ images: [] })
    expect(mockedDeleteFromR2).not.toHaveBeenCalled()
  })

  it('網址不在這輛車的圖片清單內回 403', async () => {
    signedInWith({ id: CAR, cover_image: null, images: [OWN_URL] })

    const res = await call({ url: ARTICLE_COVER_URL, type: 'gallery' })

    expect(res.status).toBe(403)
    expect(mockedDeleteFromR2).not.toHaveBeenCalled()
  })

  it('封面網址與資料庫不符回 403', async () => {
    signedInWith({ id: CAR, cover_image: OWN_URL, images: [] })

    const res = await call({ url: ARTICLE_COVER_URL, type: 'cover' })

    expect(res.status).toBe(403)
    expect(mockedDeleteFromR2).not.toHaveBeenCalled()
  })

  it.each([[{ url: 123, type: 'gallery' }], [{ url: OWN_URL }], [{ type: 'gallery' }], [{}]])(
    '缺少或型別錯誤的參數 %j 回 400',
    async (body) => {
      signedInWith({ id: CAR, cover_image: null, images: [OWN_URL] })

      const res = await call(body)

      expect(res.status).toBe(400)
      expect(mockedDeleteFromR2).not.toHaveBeenCalled()
    }
  )
})
