/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { backfillMissingArticleEmbeddings } from '../backfill-embeddings'

jest.mock('@/lib/ai/embeddings', () => ({ generateEmbedding: jest.fn() }))

type Row = { id: string; title_zh: string; content_zh: string }

/** 最小的假 Supabase：記錄查詢條件與更新內容，讓測試檢查「補了誰」。 */
function fakeSupabase(rows: Row[], options: { selectError?: string; updateError?: string } = {}) {
  const updates: Array<{ id: string; vector: number[] }> = []
  const filters: Record<string, unknown> = {}
  const select = {
    select: () => select,
    is: (column: string, value: unknown) => ((filters[`is:${column}`] = value), select),
    gte: (column: string, value: unknown) => ((filters[`gte:${column}`] = value), select),
    order: () => select,
    limit: (n: number) => {
      filters.limit = n
      return Promise.resolve(
        options.selectError
          ? { data: null, error: { message: options.selectError } }
          : { data: rows, error: null }
      )
    },
  }
  const client = {
    from: () => ({
      select: select.select,
      update: (patch: { content_embedding: number[] }) => ({
        eq: (_column: string, id: string) => {
          if (options.updateError) {
            return Promise.resolve({ error: { message: options.updateError } })
          }
          updates.push({ id, vector: patch.content_embedding })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  } as unknown as SupabaseClient
  return { client, updates, filters }
}

const rows: Row[] = [
  { id: 'a', title_zh: '標題 A', content_zh: '內文 A' },
  { id: 'b', title_zh: '標題 B', content_zh: '內文 B' },
]

describe('backfillMissingArticleEmbeddings', () => {
  it('替沒有向量的文章補上，文字格式與生成時一致', async () => {
    const { client, updates, filters } = fakeSupabase(rows)
    const embed = jest.fn().mockResolvedValue([1, 2, 3])

    const result = await backfillMissingArticleEmbeddings(client, { embed, limit: 5 })

    expect(result).toEqual({ attempted: 2, updated: 2 })
    expect(embed).toHaveBeenCalledWith('標題 A\n\n內文 A')
    expect(updates.map((u) => u.id)).toEqual(['a', 'b'])
    expect(filters['is:content_embedding']).toBeNull()
    expect(filters.limit).toBe(5)
    expect(typeof filters['gte:created_at']).toBe('string')
  })

  it('沒有需要補的文章就什麼都不做', async () => {
    const { client } = fakeSupabase([])
    const embed = jest.fn()
    expect(await backfillMissingArticleEmbeddings(client, { embed })).toEqual({
      attempted: 0,
      updated: 0,
    })
    expect(embed).not.toHaveBeenCalled()
  })

  it('第一次嵌入失敗就停手，不 throw', async () => {
    const { client, updates } = fakeSupabase(rows)
    const embed = jest.fn().mockRejectedValue(new Error('402'))

    const result = await backfillMissingArticleEmbeddings(client, { embed })

    expect(result).toEqual({ attempted: 1, updated: 0 })
    expect(embed).toHaveBeenCalledTimes(1)
    expect(updates).toEqual([])
  })

  it('查詢失敗不 throw', async () => {
    const { client } = fakeSupabase([], { selectError: 'db down' })
    await expect(backfillMissingArticleEmbeddings(client, { embed: jest.fn() })).resolves.toEqual({
      attempted: 0,
      updated: 0,
    })
  })

  it('寫回失敗不 throw，也不會繼續處理下一篇', async () => {
    const { client } = fakeSupabase(rows, { updateError: 'db down' })
    const embed = jest.fn().mockResolvedValue([1])
    await expect(backfillMissingArticleEmbeddings(client, { embed })).resolves.toEqual({
      attempted: 1,
      updated: 0,
    })
    expect(embed).toHaveBeenCalledTimes(1)
  })
})
