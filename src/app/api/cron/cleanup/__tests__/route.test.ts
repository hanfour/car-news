/**
 * @jest-environment node
 */

/**
 * cleanup cron 不得再刪除 R2 物件：bucket 內有永久保留的文章封面與車庫照片。
 */

jest.mock('@/lib/supabase', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/lib/cron/auth', () => ({
  verifyCronAuth: jest.fn(),
  unauthorized: jest.fn(),
}))
jest.mock('@/lib/admin/session', () => ({ cleanupExpiredSessions: jest.fn() }))
jest.mock('@/lib/storage/image-uploader', () => ({ deleteOldImages: jest.fn() }))

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyCronAuth, unauthorized } from '@/lib/cron/auth'
import { cleanupExpiredSessions } from '@/lib/admin/session'
import { deleteOldImages } from '@/lib/storage/image-uploader'
import { GET } from '../route'

const mockedAuth = verifyCronAuth as jest.Mock
const mockedUnauthorized = unauthorized as jest.Mock
const mockedServiceClient = createServiceClient as jest.Mock
const mockedSessions = cleanupExpiredSessions as jest.Mock
const mockedDeleteOldImages = deleteOldImages as jest.Mock

const insert = jest.fn()

function stubSupabase(deletedCount: number) {
  const lt = jest.fn().mockResolvedValue({ count: deletedCount })
  const del = jest.fn().mockReturnValue({ lt })
  const from = jest.fn().mockReturnValue({ delete: del, insert })
  mockedServiceClient.mockReturnValue({ from })
  return { from, del, lt }
}

const request = () => new NextRequest('http://localhost/api/cron/cleanup')

beforeEach(() => {
  jest.resetAllMocks()
  insert.mockResolvedValue({})
  mockedAuth.mockResolvedValue(true)
  mockedSessions.mockResolvedValue(2)
  mockedUnauthorized.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
})

describe('GET /api/cron/cleanup', () => {
  it('未通過 cron 驗證時回 401，不碰資料庫', async () => {
    mockedAuth.mockResolvedValue(false)

    const res = await GET(request())

    expect(res.status).toBe(401)
    expect(mockedServiceClient).not.toHaveBeenCalled()
    expect(mockedDeleteOldImages).not.toHaveBeenCalled()
  })

  it('不會呼叫 R2 刪圖，回應也不含 old_images', async () => {
    stubSupabase(3)

    const res = await GET(request())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockedDeleteOldImages).not.toHaveBeenCalled()
    expect(json.cleaned).not.toHaveProperty('old_images')
  })

  it('仍執行 DB 清理並回報筆數', async () => {
    stubSupabase(3)

    const res = await GET(request())
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.cleaned).toEqual({
      expired_articles: 3,
      old_locks: 3,
      old_logs: 3,
      expired_sessions: 2,
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_name: 'cleanup', status: 'success' })
    )
  })
})
