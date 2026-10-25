/**
 * @jest-environment node
 */
import { generateImagePromptFromArticle } from '../image-prompt-generator'
import { resetProviderHealth } from '../provider-health'
import { generateText as generateTextWithClaude } from '../claude'

// 只替換會連網的兩個出口（Gemini SDK、Claude 文字生成）。
// prompt 組裝、回應解析、provider 冷卻、關鍵字降級模板都走真的程式。
const mockGenerateContent = jest.fn()
const mockGetGenerativeModel = jest.fn()
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: (...args: unknown[]) => mockGetGenerativeModel(...args),
  })),
}))
jest.mock('../claude', () => ({ generateText: jest.fn() }))
jest.mock('../usage-tracker', () => ({ recordAIUsage: jest.fn() }))

const claudeText = generateTextWithClaude as jest.MockedFunction<typeof generateTextWithClaude>

const GEMINI_PROMPT =
  'Professional automotive photography. Gemini wrote this description. Sharp focus, editorial quality, no text or watermarks.'
const CLAUDE_PROMPT =
  'Professional automotive photography. Claude wrote this description. Sharp focus, editorial quality, no text or watermarks.'

function promptJson(fullPrompt: string): string {
  return JSON.stringify({
    subject: 'a subject',
    vehicleType: 'electric SUV',
    brandStyle: 'a style',
    setting: 'a studio',
    keyElements: ['one', 'two', 'three'],
    mood: 'calm',
    fullPrompt,
  })
}

/** 與正式環境 Gemini 額度用盡時收到的錯誤同一種格式。 */
function geminiBillingError(): Error {
  return new Error(
    '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [402 Payment Required] prepayment credits are depleted'
  )
}

function geminiAnswers(text: string): void {
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => text,
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
    },
  })
}

const TITLE = 'New family SUV unveiled'
const CONTENT = 'The automaker revealed a three-row model on Tuesday.'

beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-key'
})

beforeEach(() => {
  mockGenerateContent.mockReset()
  mockGetGenerativeModel.mockReset().mockReturnValue({ generateContent: mockGenerateContent })
  claudeText.mockReset()
})

// provider-health 的冷卻狀態存在模組記憶體裡，測試之間要清掉。
afterEach(() => resetProviderHealth())

describe('generateImagePromptFromArticle', () => {
  it('uses Gemini and never calls Claude while Gemini works', async () => {
    geminiAnswers(promptJson(GEMINI_PROMPT))

    const result = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(result.fullPrompt).toBe(GEMINI_PROMPT)
    expect(claudeText).not.toHaveBeenCalled()
  })

  it('asks Gemini for JSON with thinking disabled, at the temperature the caller chose', async () => {
    geminiAnswers(promptJson(GEMINI_PROMPT))

    await generateImagePromptFromArticle(TITLE, CONTENT, ['Tesla'], { temperature: 0.7 })

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        generationConfig: expect.objectContaining({
          temperature: 0.7,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        }),
      })
    )
  })

  it('falls back to Claude when Gemini fails, and gives Claude the article', async () => {
    mockGenerateContent.mockRejectedValue(geminiBillingError())
    claudeText.mockResolvedValue(promptJson(CLAUDE_PROMPT))

    const result = await generateImagePromptFromArticle(TITLE, CONTENT, ['Kia'])

    expect(result.fullPrompt).toBe(CLAUDE_PROMPT)
    expect(claudeText).toHaveBeenCalledTimes(1)
    expect(claudeText.mock.calls[0][0]).toContain(TITLE)
    expect(claudeText.mock.calls[0][0]).toContain('Kia')
  })

  it.each([
    ['plain JSON', promptJson(CLAUDE_PROMPT)],
    ['a fenced code block', '```json\n' + promptJson(CLAUDE_PROMPT) + '\n```'],
    [
      'prose before and after',
      'Here is the prompt:\n' + promptJson(CLAUDE_PROMPT) + '\nHope this helps!',
    ],
  ])('reads a Claude answer given as %s', async (_label, answer) => {
    mockGenerateContent.mockRejectedValue(geminiBillingError())
    claudeText.mockResolvedValue(answer)

    const result = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(result.fullPrompt).toBe(CLAUDE_PROMPT)
    // 其他欄位也要完整讀進來，而不是只靠正規表示式撈出 fullPrompt 的降級路徑（那條路徑的 vehicleType 固定是 'automobile'）
    expect(result.vehicleType).toBe('electric SUV')
    expect(result.keyElements).toEqual(['one', 'two', 'three'])
  })

  it('tries Claude when Gemini answers with something that is not JSON', async () => {
    geminiAnswers('Sorry, I cannot help with that.')
    claudeText.mockResolvedValue(promptJson(CLAUDE_PROMPT))

    const result = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(result.fullPrompt).toBe(CLAUDE_PROMPT)
  })

  it('does not accept an answer that has no fullPrompt', async () => {
    geminiAnswers(JSON.stringify({ subject: 'only a subject' }))
    claudeText.mockResolvedValue(promptJson(CLAUDE_PROMPT))

    const result = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(result.fullPrompt).toBe(CLAUDE_PROMPT)
  })

  it('falls back to Claude when Gemini cannot even be set up', async () => {
    mockGetGenerativeModel.mockImplementation(() => {
      throw new Error('GEMINI_API_KEY is required')
    })
    claudeText.mockResolvedValue(promptJson(CLAUDE_PROMPT))

    const result = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(result.fullPrompt).toBe(CLAUDE_PROMPT)
  })

  it('returns the keyword template, without throwing, when every provider fails', async () => {
    mockGenerateContent.mockRejectedValue(geminiBillingError())
    claudeText.mockRejectedValue(new Error('No Claude model available'))

    const result = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(claudeText).toHaveBeenCalledTimes(1)
    // 標題含 SUV，關鍵字模板會帶出 SUV 的外觀描述
    expect(result.vehicleType).toBe('sporty utility vehicle with elevated stance')
    expect(result.fullPrompt).not.toContain('wrote this description')
  })

  it('skips Gemini on the next cover once it has failed with a billing error', async () => {
    mockGenerateContent.mockRejectedValue(geminiBillingError())
    claudeText.mockResolvedValue(promptJson(CLAUDE_PROMPT))

    await generateImagePromptFromArticle(TITLE, CONTENT)
    const second = await generateImagePromptFromArticle(TITLE, CONTENT)

    expect(second.fullPrompt).toBe(CLAUDE_PROMPT)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(claudeText).toHaveBeenCalledTimes(2)
  })
})
