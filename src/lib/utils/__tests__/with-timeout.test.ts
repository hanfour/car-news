import { withTimeout, TimeoutError } from '../with-timeout'

describe('withTimeout', () => {
  it('resolves with the value when promise settles before timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 100, 'answer')
    expect(result).toBe(42)
  })

  it('rejects with TimeoutError when promise exceeds timeout', async () => {
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(1), 200))
    await expect(withTimeout(slow, 50, 'slow-op')).rejects.toBeInstanceOf(TimeoutError)
  })

  it('includes the label in the timeout error message', async () => {
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(1), 200))
    await expect(withTimeout(slow, 50, 'rss:autohome')).rejects.toThrow('rss:autohome')
  })

  it('propagates the inner rejection reason', async () => {
    const failing = Promise.reject(new Error('inner-failure'))
    await expect(withTimeout(failing, 100, 'x')).rejects.toThrow('inner-failure')
  })

  it('clears the timer after resolution', async () => {
    // 確保不會在 Jest 結束後還有 pending timer
    const spy = jest.spyOn(global, 'clearTimeout')
    await withTimeout(Promise.resolve('ok'), 100, 'x')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
