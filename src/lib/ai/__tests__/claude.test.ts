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

describe('Claude 回應處理', () => {
  const thinkingBlock = { type: 'thinking', thinking: '' }

  it('thinking 區塊排在前面時，仍能取出後面的文章（過去因此得到空字串而失敗）', async () => {
    anthropicCreate.mockResolvedValue({
      content: [thinkingBlock, { type: 'text', text: articleJson }],
      stop_reason: 'end_turn',
      usage: {},
    })
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.title_zh).toBe('標題')
    expect(openaiCreate).not.toHaveBeenCalled()
  })

  it('被 max_tokens 截斷時視為失敗，並改用 OpenAI', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"title_zh":"半' }],
      stop_reason: 'max_tokens',
      usage: {},
    })
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: articleJson } }],
      usage: {},
    })
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.title_zh).toBe('標題')
    expect(openaiCreate).toHaveBeenCalledTimes(1)
  })

  it('JSON 前後有多餘的說明文字也能解析', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: `以下是文章：\n${articleJson}\n以上。` }],
      stop_reason: 'end_turn',
      usage: {},
    })
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.title_zh).toBe('標題')
  })

  it('輸出上限留足空間，避免思考把額度吃光', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: articleJson }],
      stop_reason: 'end_turn',
      usage: {},
    })
    const { generateArticleWithClaude } = await loadClaude()

    await generateArticleWithClaude(input)

    expect(anthropicCreate.mock.calls[0][0].max_tokens).toBe(16000)
  })
})

describe('Sonnet 5.5 的思考設定', () => {
  const okResponse = {
    content: [{ type: 'text', text: articleJson }],
    stop_reason: 'end_turn',
    usage: {},
  }

  it('Sonnet 5.5 會送出關閉思考的參數', async () => {
    process.env.CLAUDE_MODEL = 'claude-sonnet-5-5'
    anthropicCreate.mockResolvedValue(okResponse)
    const { generateArticleWithClaude } = await loadClaude()

    await generateArticleWithClaude(input)

    expect(anthropicCreate.mock.calls[0][0].thinking).toEqual({ type: 'between_tools' })
  })

  it('其他模型不送 thinking 參數', async () => {
    process.env.CLAUDE_MODEL = 'claude-sonnet-4-6'
    anthropicCreate.mockResolvedValue(okResponse)
    const { generateArticleWithClaude } = await loadClaude()

    await generateArticleWithClaude(input)

    expect(anthropicCreate.mock.calls[0][0]).not.toHaveProperty('thinking')
  })

  it('API 因 thinking 參數回 400 時，退回不帶它的請求而不是整個失敗', async () => {
    process.env.CLAUDE_MODEL = 'claude-sonnet-5-5'
    anthropicCreate
      .mockRejectedValueOnce(httpError(400, 'thinking.type: Input should be adaptive'))
      .mockResolvedValueOnce(okResponse)
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.title_zh).toBe('標題')
    expect(anthropicCreate).toHaveBeenCalledTimes(2)
    expect(anthropicCreate.mock.calls[0][0]).toHaveProperty('thinking')
    expect(anthropicCreate.mock.calls[1][0]).not.toHaveProperty('thinking')
    expect(openaiCreate).not.toHaveBeenCalled()
  })

  it('與 thinking 無關的 400（例如餘額不足）不重試，直接改用 OpenAI', async () => {
    process.env.CLAUDE_MODEL = 'claude-sonnet-5-5'
    anthropicCreate.mockRejectedValue(httpError(400, 'Your credit balance is too low'))
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: articleJson } }],
      usage: {},
    })
    const { generateArticleWithClaude } = await loadClaude()

    await generateArticleWithClaude(input)

    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(openaiCreate).toHaveBeenCalledTimes(1)
  })
})

describe('generateText (Claude) 的回應處理', () => {
  it('thinking 區塊在前時仍能取出文字', async () => {
    anthropicCreate.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: '摘要內容' },
      ],
      stop_reason: 'end_turn',
      usage: {},
    })
    const { generateText } = await loadClaude()

    expect(await generateText('hello')).toBe('摘要內容')
  })

  it('被截斷的短文字可以接受', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '摘要的前半' }],
      stop_reason: 'max_tokens',
      usage: {},
    })
    const { generateText } = await loadClaude()

    expect(await generateText('hello')).toBe('摘要的前半')
  })

  it('完全沒有文字時丟錯，而不是回傳空字串', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'thinking', thinking: '' }],
      stop_reason: 'end_turn',
      usage: {},
    })
    const { generateText } = await loadClaude()

    await expect(generateText('hello')).rejects.toThrow(/no text/)
  })
})

describe('記錄實際寫稿的模型 (ai_model)', () => {
  it('Claude 寫稿時，記錄實際使用的 Claude 模型 id', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: articleJson }], usage: {} })
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.ai_model).toBe('claude-sonnet-test')
  })

  it('Claude 失敗改由 OpenAI 寫稿時，記錄的是 gpt-4o 而不是 Claude', async () => {
    anthropicCreate.mockRejectedValue(httpError(400, 'bad request'))
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: articleJson } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.ai_model).toBe('gpt-4o')
  })

  it.each(['Claude', 'OpenAI'])('%s 寫稿時，模型自己輸出的 ai_model 欄位不採用', async (writer) => {
    // 來源文章的文字可能誘導模型在 JSON 裡亂填這個欄位，記錄的值必須由程式決定。
    const forged = JSON.stringify({
      title_zh: '標題',
      content_zh: '內文',
      ai_model: 'forged-by-source-text',
    })
    if (writer === 'Claude') {
      anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: forged }], usage: {} })
    } else {
      anthropicCreate.mockRejectedValue(httpError(400, 'bad request'))
      openaiCreate.mockResolvedValue({
        choices: [{ message: { content: forged } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })
    }
    const { generateArticleWithClaude } = await loadClaude()

    const result = await generateArticleWithClaude(input)

    expect(result.ai_model).toBe(writer === 'Claude' ? 'claude-sonnet-test' : 'gpt-4o')
  })
})
