/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { FALLBACK_MAX_ARTICLES, prepareRawArticles } from '../prepare-articles'
import { embedManyWithProvider, generateEmbedding } from '@/lib/ai/embeddings'
import type { RawArticle } from '@/types/database'

jest.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: jest.fn(),
  embedManyWithProvider: jest.fn(),
}))
// 過濾規則不是這裡要測的重點，直接放行。
jest.mock('@/lib/utils/brand-extractor', () => ({
  filterCarArticles: (articles: unknown[]) => articles,
}))

const mockEmbedOne = generateEmbedding as jest.Mock
const mockEmbedMany = embedManyWithProvider as jest.Mock

function article(id: number, overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    id: `raw-${id}`,
    url: `https://example.com/${id}`,
    title: `Title ${id}`,
    content: `Content ${id}`,
    scraped_at: new Date(2026, 9, 24, 0, id).toISOString(),
    expires_at: '2099-01-01T00:00:00Z',
    embedding: null as unknown as number[],
    ...overrides,
  }
}

function fakeSupabase(rows: RawArticle[]) {
  const updates: Array<{ id: string; embedding: number[] }> = []
  const query = {
    select: () => query,
    gt: () => query,
    is: () => Promise.resolve({ data: rows, error: null }),
  }
  const client = {
    from: () => ({
      select: query.select,
      update: (patch: { embedding: number[] }) => ({
        eq: (_column: string, id: string) => {
          updates.push({ id, embedding: patch.embedding })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  } as unknown as SupabaseClient
  return { client, updates }
}

beforeEach(() => {
  mockEmbedOne.mockReset()
  mockEmbedMany.mockReset()
  delete process.env.DISABLE_EMBEDDINGS
})

describe('prepareRawArticles：一般模式', () => {
  it('只為缺向量的文章補嵌入，並寫回資料庫', async () => {
    const rows = [article(1, { embedding: [9] }), article(2), article(3)]
    const { client, updates } = fakeSupabase(rows)
    mockEmbedOne.mockResolvedValue([7, 7])

    const result = await prepareRawArticles(client)

    expect(mockEmbedOne).toHaveBeenCalledTimes(2)
    expect(updates.map((u) => u.id)).toEqual(['raw-2', 'raw-3'])
    expect(mockEmbedMany).not.toHaveBeenCalled()
    expect(result.embeddingFailures).toBe(0)
    expect(result.carArticles.map((a) => a.embedding)).toEqual([[9], [7, 7], [7, 7]])
  })

  it('素材不足三篇就直接結束', async () => {
    const { client } = fakeSupabase([article(1), article(2)])
    const result = await prepareRawArticles(client)
    expect(result.carArticles).toEqual([])
    expect(mockEmbedOne).not.toHaveBeenCalled()
  })
})

describe('prepareRawArticles：降級模式', () => {
  it('用備援 provider 重新嵌入全部文章，且完全不寫回資料庫', async () => {
    // 其中一篇已經有主要 provider 的舊向量，降級模式也必須重算，避免兩種向量混在一起。
    const rows = [article(1, { embedding: [9] }), article(2), article(3)]
    const { client, updates } = fakeSupabase(rows)
    mockEmbedMany.mockImplementation(async (_provider: string, texts: string[]) =>
      texts.map((_, i) => [100 + i])
    )

    const result = await prepareRawArticles(client, {
      embeddingMode: 'fallback',
      fallbackProvider: 'openai',
    })

    expect(mockEmbedMany).toHaveBeenCalledTimes(1)
    expect(mockEmbedMany.mock.calls[0][0]).toBe('openai')
    expect(mockEmbedMany.mock.calls[0][1]).toHaveLength(3)
    expect(mockEmbedOne).not.toHaveBeenCalled()
    expect(updates).toEqual([])
    // 最新的排最前面：raw-3 最新
    expect(result.carArticles.map((a) => a.id)).toEqual(['raw-3', 'raw-2', 'raw-1'])
    expect(result.carArticles.map((a) => a.embedding)).toEqual([[100], [101], [102]])
  })

  it('超過上限時只取最新的那些', async () => {
    const rows = Array.from({ length: FALLBACK_MAX_ARTICLES + 5 }, (_, i) => article(i))
    const { client } = fakeSupabase(rows)
    mockEmbedMany.mockImplementation(async (_provider: string, texts: string[]) =>
      texts.map(() => [1])
    )

    const result = await prepareRawArticles(client, {
      embeddingMode: 'fallback',
      fallbackProvider: 'openai',
    })

    expect(result.carArticles).toHaveLength(FALLBACK_MAX_ARTICLES)
    expect(mockEmbedMany.mock.calls[0][1]).toHaveLength(FALLBACK_MAX_ARTICLES)
    // 最舊的幾篇被捨棄
    const ids = new Set(result.carArticles.map((a) => a.id))
    expect(ids.has('raw-0')).toBe(false)
    expect(ids.has(`raw-${FALLBACK_MAX_ARTICLES + 4}`)).toBe(true)
  })

  it('沒有指定備援 provider 就拒絕執行', async () => {
    const { client } = fakeSupabase([article(1), article(2), article(3)])
    await expect(prepareRawArticles(client, { embeddingMode: 'fallback' })).rejects.toThrow(
      /fallback provider/
    )
  })

  it('DISABLE_EMBEDDINGS 優先於降級模式', async () => {
    process.env.DISABLE_EMBEDDINGS = 'true'
    const { client } = fakeSupabase([article(1), article(2), article(3)])
    await prepareRawArticles(client, { embeddingMode: 'fallback', fallbackProvider: 'openai' })
    expect(mockEmbedMany).not.toHaveBeenCalled()
  })

  it('備援嵌入失敗時往外丟，讓這一輪被記為失敗', async () => {
    const { client } = fakeSupabase([article(1), article(2), article(3)])
    mockEmbedMany.mockRejectedValue(new Error('429'))
    await expect(
      prepareRawArticles(client, { embeddingMode: 'fallback', fallbackProvider: 'openai' })
    ).rejects.toThrow('429')
  })
})
