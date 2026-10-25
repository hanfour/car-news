/**
 * @jest-environment node
 */
import { generateArticleWithGemini } from '../gemini'

// 只替換會連網的 Gemini SDK；model 名稱對應、回應解析都走真的程式。
const mockGenerateContent = jest.fn()
const mockGetGenerativeModel = jest.fn()
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: (...args: unknown[]) => mockGetGenerativeModel(...args),
  })),
}))
jest.mock('../usage-tracker', () => ({ recordAIUsage: jest.fn() }))

const input = { sources: [], systemPrompt: 's', styleGuide: 'g' }

function geminiAnswers(payload: Record<string, unknown>): void {
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => JSON.stringify(payload),
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    },
  })
}

beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-key'
})

beforeEach(() => {
  mockGenerateContent.mockReset()
  mockGetGenerativeModel.mockReset().mockReturnValue({ generateContent: mockGenerateContent })
})

describe('generateArticleWithGemini 記錄實際寫稿的模型 (ai_model)', () => {
  it.each([
    ['flash', 'gemini-2.5-flash'],
    ['pro', 'gemini-2.5-pro'],
  ] as const)('選 %s 時記錄為 %s，且與實際請求的模型一致', async (choice, modelId) => {
    geminiAnswers({ title_zh: '標題', content_zh: '內文' })

    const result = await generateArticleWithGemini(input, choice)

    expect(result.ai_model).toBe(modelId)
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: modelId }))
  })

  it('模型自己輸出的 ai_model 欄位不採用', async () => {
    // 來源文章的文字可能誘導模型在 JSON 裡亂填這個欄位，記錄的值必須由程式決定。
    geminiAnswers({ title_zh: '標題', content_zh: '內文', ai_model: 'forged-by-source-text' })

    const result = await generateArticleWithGemini(input)

    expect(result.ai_model).toBe('gemini-2.5-flash')
  })
})
