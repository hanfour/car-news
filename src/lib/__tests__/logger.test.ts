/**
 * Logger 在 NODE_ENV=test 時預設靜音 — 此處暫時切回 development 以便驗證輸出格式
 */
describe('logger', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.resetModules()
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
    jest.restoreAllMocks()
  })

  it('info 輸出 JSON 結構 log', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../logger')
    logger.info('article.generated', { id: 'a-1', brand: 'Tesla' })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.level).toBe('info')
    expect(parsed.event).toBe('article.generated')
    expect(parsed.id).toBe('a-1')
    expect(parsed.brand).toBe('Tesla')
    expect(typeof parsed.ts).toBe('string')
  })

  it('error 序列化 Error 物件為可讀格式', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../logger')
    const err = new Error('boom')
    logger.error('ai.fail', err, { retry: 2 })

    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.level).toBe('error')
    expect(parsed.event).toBe('ai.fail')
    expect(parsed.retry).toBe(2)
    expect(parsed.error.name).toBe('Error')
    expect(parsed.error.message).toBe('boom')
  })

  it('warn 走 console.warn', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../logger')
    logger.warn('slow.query', { ms: 1200 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('test 環境（NODE_ENV=test）預設靜音', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true })
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.resetModules()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../logger')
    logger.info('should.not.emit', {})
    expect(spy).not.toHaveBeenCalled()
  })
})
