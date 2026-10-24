/**
 * @jest-environment node
 */
import {
  formatAlertText,
  hasAlertChannel,
  readAlertConfig,
  sendAlert,
  type AlertDeps,
  type AlertInput,
  type AlertStore,
} from '../alerts'

const WEBHOOK = 'https://hooks.example.com/services/test'
const input: AlertInput = {
  key: 'provider:gemini:billing',
  severity: 'error',
  title: 'Gemini 額度用盡',
  details: ['HTTP 402'],
}

function okResponse(ok = true) {
  return { ok } as Response
}

function makeStore(last: number | null = null): AlertStore & {
  markSent: jest.Mock
  lastSentAt: jest.Mock
} {
  return {
    lastSentAt: jest.fn().mockResolvedValue(last),
    markSent: jest.fn().mockResolvedValue(undefined),
  }
}

function makeDeps(overrides: Partial<AlertDeps> = {}) {
  const fetchImpl = jest.fn().mockResolvedValue(okResponse())
  const store = makeStore()
  const deps: Partial<AlertDeps> = {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    store,
    now: () => 10_000_000,
    config: { webhookUrl: WEBHOOK },
    ...overrides,
  }
  return { deps, fetchImpl, store }
}

describe('readAlertConfig / hasAlertChannel', () => {
  it('空白視為沒設定', () => {
    const config = readAlertConfig({ ALERT_WEBHOOK_URL: '   ', TELEGRAM_BOT_TOKEN: 't' })
    expect(config.webhookUrl).toBeUndefined()
    expect(hasAlertChannel(config)).toBe(false)
  })

  it('Telegram 需要 token 與 chat id 兩個都有', () => {
    expect(hasAlertChannel({ telegramBotToken: 't' })).toBe(false)
    expect(hasAlertChannel({ telegramBotToken: 't', telegramChatId: '1' })).toBe(true)
  })

  it('只有 webhook 也算有管道', () => {
    expect(hasAlertChannel({ webhookUrl: WEBHOOK })).toBe(true)
  })
})

describe('formatAlertText', () => {
  it('包含標題、細節與網站名稱', () => {
    const text = formatAlertText(input, 'https://example.com')
    expect(text).toContain('Gemini 額度用盡')
    expect(text).toContain('- HTTP 402')
    expect(text).toContain('https://example.com')
  })

  it('遮蔽金鑰並限制長度', () => {
    const key = 'AIza' + 'x'.repeat(35)
    const text = formatAlertText({ ...input, details: [`key ${key}`, 'y'.repeat(5000)] })
    expect(text).not.toContain(key)
    expect(text.length).toBeLessThanOrEqual(1800)
  })
})

describe('sendAlert', () => {
  it('沒有任何管道時不送出，也不查資料庫', async () => {
    const { deps, fetchImpl, store } = makeDeps({ config: {} })
    const result = await sendAlert(input, deps)
    expect(result).toEqual({ sent: false, reason: 'no_channel' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(store.lastSentAt).not.toHaveBeenCalled()
  })

  it('送到 webhook，同時帶 text 與 content，並記錄已送出', async () => {
    const { deps, fetchImpl, store } = makeDeps()
    const result = await sendAlert(input, deps)

    expect(result).toEqual({ sent: true, reason: 'sent' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(WEBHOOK)
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.text).toContain('Gemini 額度用盡')
    expect(body.content).toBe(body.text)
    expect(store.markSent).toHaveBeenCalledWith(
      'provider:gemini:billing',
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('冷卻時間內不重複送', async () => {
    const store = makeStore(10_000_000 - 60 * 60_000) // 一小時前才送過
    const { deps, fetchImpl } = makeDeps({ store })
    const result = await sendAlert(input, deps)
    expect(result).toEqual({ sent: false, reason: 'deduped' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('超過冷卻時間會再送一次', async () => {
    const store = makeStore(10_000_000 - 7 * 60 * 60_000) // 七小時前
    const { deps, fetchImpl } = makeDeps({ store })
    const result = await sendAlert(input, deps)
    expect(result.sent).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('可以用 cooldownMinutes 縮短冷卻', async () => {
    const store = makeStore(10_000_000 - 20 * 60_000)
    const { deps, fetchImpl } = makeDeps({ store })
    const result = await sendAlert({ ...input, cooldownMinutes: 10 }, deps)
    expect(result.sent).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('送到 Telegram：網址含 token，內文帶 chat_id', async () => {
    const { deps, fetchImpl } = makeDeps({
      config: { telegramBotToken: 'bot-token', telegramChatId: '123' },
    })
    await sendAlert(input, deps)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/botbot-token/sendMessage')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.chat_id).toBe('123')
    expect(body.text).toContain('Gemini 額度用盡')
  })

  it('兩個管道只要有一個成功就算送出', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okResponse(false))
      .mockResolvedValueOnce(okResponse(true))
    const { deps, store } = makeDeps({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      config: { webhookUrl: WEBHOOK, telegramBotToken: 't', telegramChatId: '1' },
    })
    const result = await sendAlert(input, deps)
    expect(result.sent).toBe(true)
    expect((store as ReturnType<typeof makeStore>).markSent).toHaveBeenCalled()
  })

  it('全部失敗時回報 failed，且不記錄已送出（下一輪會再試）', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'))
    const { deps, store } = makeDeps({ fetchImpl: fetchImpl as unknown as typeof fetch })
    const result = await sendAlert(input, deps)
    expect(result).toEqual({ sent: false, reason: 'failed' })
    expect((store as ReturnType<typeof makeStore>).markSent).not.toHaveBeenCalled()
  })

  it('查不到冷卻紀錄時仍然送出', async () => {
    const store = makeStore()
    store.lastSentAt.mockRejectedValue(new Error('db down'))
    const { deps, fetchImpl } = makeDeps({ store })
    const result = await sendAlert(input, deps)
    expect(result.sent).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('記錄已送出失敗不影響結果', async () => {
    const store = makeStore()
    store.markSent.mockRejectedValue(new Error('db down'))
    const { deps } = makeDeps({ store })
    await expect(sendAlert(input, deps)).resolves.toEqual({ sent: true, reason: 'sent' })
  })
})
