/**
 * @jest-environment node
 */
const openaiCreate = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ embeddings: { create: openaiCreate } })),
}))
jest.mock('../usage-tracker', () => ({ recordAIUsage: jest.fn() }))

import {
  EMBEDDING_DIMENSIONS,
  embedManyWithProvider,
  getFallbackEmbeddingProvider,
  getPrimaryEmbeddingProvider,
} from '../embeddings'

const ENV_KEYS = ['EMBEDDING_PROVIDER', 'EMBEDDING_FALLBACK', 'OPENAI_API_KEY', 'GEMINI_API_KEY']
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  openaiCreate.mockReset()
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('provider 選擇', () => {
  it('預設主要是 Gemini', () => {
    expect(getPrimaryEmbeddingProvider()).toBe('gemini')
  })

  it('EMBEDDING_PROVIDER 為其他值時用 OpenAI（與過去的行為一致）', () => {
    process.env.EMBEDDING_PROVIDER = 'openai'
    expect(getPrimaryEmbeddingProvider()).toBe('openai')
  })

  it('有 OpenAI 金鑰時，Gemini 的備援是 OpenAI', () => {
    process.env.OPENAI_API_KEY = 'x'
    expect(getFallbackEmbeddingProvider()).toBe('openai')
  })

  it('沒有 OpenAI 金鑰就沒有備援', () => {
    expect(getFallbackEmbeddingProvider()).toBeNull()
  })

  it('EMBEDDING_FALLBACK=off 關閉備援', () => {
    process.env.OPENAI_API_KEY = 'x'
    process.env.EMBEDDING_FALLBACK = 'off'
    expect(getFallbackEmbeddingProvider()).toBeNull()
  })

  it('主要是 OpenAI 時，備援是 Gemini（需要 Gemini 金鑰）', () => {
    process.env.EMBEDDING_PROVIDER = 'openai'
    expect(getFallbackEmbeddingProvider()).toBeNull()
    process.env.GEMINI_API_KEY = 'x'
    expect(getFallbackEmbeddingProvider()).toBe('gemini')
  })
})

describe('embedManyWithProvider（OpenAI）', () => {
  it('每次都指定資料庫的向量維度，避免產生長度不符的向量', async () => {
    process.env.OPENAI_API_KEY = 'x'
    openaiCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1] }], usage: {} })

    await embedManyWithProvider('openai', ['a'])

    expect(openaiCreate.mock.calls[0][0].dimensions).toBe(EMBEDDING_DIMENSIONS)
    expect(EMBEDDING_DIMENSIONS).toBe(768)
  })

  it('超過一批的輸入會分批送出，結果順序與輸入一致', async () => {
    process.env.OPENAI_API_KEY = 'x'
    openaiCreate.mockImplementation(async ({ input }: { input: string[] }) => ({
      // 刻意倒序回傳，確認依 index 排回正確順序
      data: input.map((text, index) => ({ index, embedding: [Number(text)] })).reverse(),
      usage: {},
    }))
    const texts = Array.from({ length: 130 }, (_, i) => String(i))

    const result = await embedManyWithProvider('openai', texts)

    expect(
      openaiCreate.mock.calls.map((call) => call[0].input.length).sort((a, b) => b - a)
    ).toEqual([64, 64, 2])
    expect(result.map((vector) => vector[0])).toEqual(texts.map(Number))
  })

  it('空輸入不呼叫 API', async () => {
    process.env.OPENAI_API_KEY = 'x'
    expect(await embedManyWithProvider('openai', [])).toEqual([])
    expect(openaiCreate).not.toHaveBeenCalled()
  })
})
