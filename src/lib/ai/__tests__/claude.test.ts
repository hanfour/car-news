/**
 * @jest-environment node
 */

// 只驗證「送給 Anthropic 與 OpenAI 的請求長什麼樣」與「失敗時保留哪些錯誤」，不碰真的 SDK。
const anthropicCreate = jest.fn()
const anthropicList = jest.fn()
const openaiCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: anthropicCreate },
    models: { list: anthropicList },
  })),
}))
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: openaiCreate } },
  })),
}))
jest.mock('../usage-tracker', () => ({ recordAIUsage: jest.fn() }))

const input = { sources: [], systemPrompt: 's', styleGuide: 'g' }
const articleJson = JSON.stringify({ title_zh: '標題', content_zh: '內文' })

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

async function loadClaude() {
  jest.resetModules()
  return import('../claude')
}

beforeEach(() => {
  anthropicCreate.mockReset()
  anthropicList.mockReset()
  openaiCreate.mockReset()
  anthropicList.mockResolvedValue({
    data: [{ id: 'claude-sonnet-test', display_name: 'Sonnet Test', created_at: '2026-01-01' }],
  })
  delete process.env.CLAUDE_MODEL
})

afterEach(() => {
  delete process.env.CLAUDE_MODEL
})

describe('generateArticleWithClaude', () => {
  it('不會把 temperature 送給 Anthropic（新模型已不接受）', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: articleJson }], usage: {} })
    const { generateArticleWithClaude } = await loadClaude()

    await generateArticleWithClaude(input)

    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(anthropicCreate.mock.calls[0][0]).not.toHaveProperty('temperature')
  })

  it('設定 CLAUDE_MODEL 時直接使用，不再查詢模型清單', async () => {
    process.env.CLAUDE_MODEL = 'claude-pinned-model'
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: articleJson }], usage: {} })
    const { generateArticleWithClaude } = await loadClaude()

    await generateArticleWithClaude(input)

    expect(anthropicList).not.toHaveBeenCalled()
    expect(anthropicCreate.mock.calls[0][0].model).toBe('claude-pinned-model')
  })

  it('Claude 失敗時改用 OpenAI 並回傳結果', async () => {
    anthropicCreate.mockRejectedValue(httpError(400, 'bad request'))
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: articleJson } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.title_zh).toBe('標題')
    expect(openaiCreate).toHaveBeenCalledTimes(1)
  })

  it('兩邊都失敗時丟出 AggregateError，並保留兩邊的原始錯誤', async () => {
    const claudeFailure = httpError(402, 'Your credit balance is too low')
    const openaiFailure = httpError(429, 'You exceeded your current quota')
    anthropicCreate.mockRejectedValue(claudeFailure)
    openaiCreate.mockRejectedValue(openaiFailure)
    const { generateArticleWithClaude } = await loadClaude()

    let thrown: unknown
    try {
      await generateArticleWithClaude(input)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toEqual([claudeFailure, openaiFailure])
    expect((thrown as AggregateError).message).toContain('both Claude and OpenAI')
  })
})

describe('generateText (Claude)', () => {
  it('也不送 temperature', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], usage: {} })
    const { generateText } = await loadClaude()

    await generateText('hello', { temperature: 0.2 })

    expect(anthropicCreate.mock.calls[0][0]).not.toHaveProperty('temperature')
  })
})
