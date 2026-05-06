/**
 * @jest-environment node
 */
import { pickBestCoverImage } from '../cover-image-picker'

jest.mock('@/lib/experiments/scorer', () => ({
  scoreImage: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { scoreImage } from '@/lib/experiments/scorer'

const mockScoreImage = scoreImage as jest.MockedFunction<typeof scoreImage>

function fakeScore(composite: number, vehicleAccuracy = composite) {
  return {
    composite,
    explanation: 'test',
    dimensions: {
      vehicleAccuracy,
      detailFidelity: composite,
      composition: composite,
      mood: composite,
      technicalQuality: composite,
      editorialFit: composite,
    },
  }
}

beforeEach(() => {
  mockScoreImage.mockReset()
})

describe('pickBestCoverImage', () => {
  it('回 null 當 candidates 為空', async () => {
    const result = await pickBestCoverImage([], 'Tesla 新車')
    expect(result).toBeNull()
    expect(mockScoreImage).not.toHaveBeenCalled()
  })

  it('挑出 composite 最高分且 >= 7 的圖', async () => {
    mockScoreImage
      .mockResolvedValueOnce(fakeScore(6.5)) // 第一張：低分（廣告 banner 模擬）
      .mockResolvedValueOnce(fakeScore(8.5)) // 第二張：高分（真實車輛照）
      .mockResolvedValueOnce(fakeScore(7.2)) // 第三張：中間

    const candidates = [
      { url: 'https://a.com/banner.jpg', credit: 'A' },
      { url: 'https://b.com/tesla.jpg', credit: 'B' },
      { url: 'https://c.com/other.jpg', credit: 'C' },
    ]
    const result = await pickBestCoverImage(candidates, 'Tesla Model Y')

    expect(result).not.toBeNull()
    expect(result?.url).toBe('https://b.com/tesla.jpg')
    expect(result?.credit).toBe('B')
    expect(result?.composite).toBe(8.5)
  })

  it('回 null 當所有候選 composite < 7 (信號讓呼叫端 fallback Flux)', async () => {
    mockScoreImage
      .mockResolvedValueOnce(fakeScore(5.5))
      .mockResolvedValueOnce(fakeScore(6.0))
      .mockResolvedValueOnce(fakeScore(6.9)) // 接近但仍未過 threshold

    const candidates = [
      { url: 'https://a.com/x.jpg', credit: 'A' },
      { url: 'https://b.com/y.jpg', credit: 'B' },
      { url: 'https://c.com/z.jpg', credit: 'C' },
    ]
    const result = await pickBestCoverImage(candidates, 'Tesla')

    expect(result).toBeNull()
  })

  it('部分 scoring 失敗時，從成功的圖中挑最佳', async () => {
    mockScoreImage
      .mockRejectedValueOnce(new Error('Vision API down'))
      .mockResolvedValueOnce(fakeScore(8.0))
      .mockRejectedValueOnce(new Error('Network'))

    const candidates = [
      { url: 'https://a.com/fail.jpg', credit: 'A' },
      { url: 'https://b.com/ok.jpg', credit: 'B' },
      { url: 'https://c.com/fail2.jpg', credit: 'C' },
    ]
    const result = await pickBestCoverImage(candidates, 'Tesla')

    expect(result?.url).toBe('https://b.com/ok.jpg')
  })

  it('全部 scoring 失敗時回 null', async () => {
    mockScoreImage
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))

    const candidates = [
      { url: 'https://a.com/x.jpg', credit: 'A' },
      { url: 'https://b.com/y.jpg', credit: 'B' },
    ]
    const result = await pickBestCoverImage(candidates, 'Tesla')

    expect(result).toBeNull()
  })

  it('保留候選的 caption 欄位', async () => {
    mockScoreImage.mockResolvedValueOnce(fakeScore(8.0))

    const candidates = [{ url: 'https://a.com/x.jpg', credit: 'A', caption: '原始說明' }]
    const result = await pickBestCoverImage(candidates, 'Tesla')

    expect(result?.caption).toBe('原始說明')
  })

  it('剛好等於 7.0 的 composite 視為合格（>= 邊界）', async () => {
    mockScoreImage.mockResolvedValueOnce(fakeScore(7.0))

    const candidates = [{ url: 'https://a.com/x.jpg', credit: 'A' }]
    const result = await pickBestCoverImage(candidates, 'Tesla')

    expect(result?.composite).toBe(7.0)
  })
})
