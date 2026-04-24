/**
 * @jest-environment node
 */
import { secureCompare } from '../secure-compare'

describe('secureCompare', () => {
  it('returns true for identical strings', async () => {
    expect(await secureCompare('abc', 'abc')).toBe(true)
    expect(await secureCompare('', '')).toBe(true)
  })

  it('returns false for different strings of the same length', async () => {
    expect(await secureCompare('abc', 'abd')).toBe(false)
    expect(await secureCompare('hello', 'world')).toBe(false)
  })

  it('returns false for different lengths', async () => {
    expect(await secureCompare('abc', 'abcd')).toBe(false)
    expect(await secureCompare('a', '')).toBe(false)
  })

  it('handles unicode correctly', async () => {
    expect(await secureCompare('日本語', '日本語')).toBe(true)
    expect(await secureCompare('日本語', '中文語')).toBe(false)
  })

  it('returns false for non-string inputs', async () => {
    // @ts-expect-error testing runtime guard
    expect(await secureCompare(null, 'abc')).toBe(false)
    // @ts-expect-error testing runtime guard
    expect(await secureCompare('abc', undefined)).toBe(false)
  })
})
