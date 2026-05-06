/**
 * @jest-environment node
 *
 * 測試重點是新增的 timeout / budget 行為。實際 fetch + R2 路徑用 mock。
 */
import { downloadAndStoreImage, downloadAndStoreImages } from '../image-downloader'

// Mock 上游依賴 — 這些路徑都是 IO，本測試不關心其內部正確性
jest.mock('../r2-client', () => ({
  uploadToR2: jest.fn(async (filename: string) => `https://r2.example/${filename}`),
}))
jest.mock('@/config/image-sources', () => ({
  isLegalImageSource: jest.fn(() => ({ isLegal: true, source: 'test', domain: 'example.com' })),
  getImageSourceCredit: jest.fn(() => 'Test Credit'),
}))
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock global fetch
const mockFetch = jest.fn()
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch
})
beforeEach(() => {
  mockFetch.mockReset()
})

function makeOkImageResponse(sizeBytes = 100_000) {
  const buffer = Buffer.alloc(sizeBytes)
  return {
    ok: true,
    status: 200,
    headers: {
      get: (key: string) => (key.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
    },
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as Response
}

describe('downloadAndStoreImage — timeout 行為', () => {
  it('完成正常下載 → 回傳 StoredImage', async () => {
    mockFetch.mockResolvedValueOnce(makeOkImageResponse())
    const result = await downloadAndStoreImage('https://example.com/a.jpg', 'art-123', 'Credit')
    expect(result).not.toBeNull()
    expect(result?.url).toContain('r2.example')
  })

  it('fetch 永不 settle 時，整支會在 PER_IMAGE_TIMEOUT_MS 內 reject 並回傳 null', async () => {
    // 製造一個永不 resolve 的 fetch
    mockFetch.mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    )

    // jest fake timers 推進時鐘讓 withTimeout 觸發
    jest.useFakeTimers()
    const promise = downloadAndStoreImage('https://example.com/slow.jpg', 'art-123')
    jest.advanceTimersByTime(60_001)
    const result = await promise
    jest.useRealTimers()

    expect(result).toBeNull()
  })
})

describe('downloadAndStoreImages — batch budget', () => {
  it('總時間沒超過 budgetMs 時跑完全部 chunks', async () => {
    mockFetch.mockResolvedValue(makeOkImageResponse())

    const images = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example.com/${i}.jpg`,
      credit: 'C',
    }))

    const results = await downloadAndStoreImages(images, 'art-123', { budgetMs: 60_000 })
    expect(results).toHaveLength(6)
  })

  it('超過 budgetMs 時跳過剩餘 chunks，回傳已成功的部分', async () => {
    // 每張圖片 fetch 都馬上成功，但我們手動把 budgetMs 設 0，模擬一進迴圈就超預算
    mockFetch.mockResolvedValue(makeOkImageResponse())

    const images = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/${i}.jpg`,
      credit: 'C',
    }))

    const results = await downloadAndStoreImages(images, 'art-123', { budgetMs: 0 })

    // budgetMs=0 → 第一輪 elapsed >= 0 立刻 break，回空陣列
    expect(results).toHaveLength(0)
  })

  it('預設 budgetMs 90s — 沒傳 options 時使用預設值', async () => {
    mockFetch.mockResolvedValue(makeOkImageResponse())

    const images = [{ url: 'https://example.com/a.jpg', credit: 'C' }]
    // 不傳 options，應走預設值 90_000ms
    const results = await downloadAndStoreImages(images, 'art-123')
    expect(results).toHaveLength(1)
  })
})
