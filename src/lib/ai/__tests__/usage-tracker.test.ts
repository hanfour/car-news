/**
 * @jest-environment node
 */
import { estimateCost } from '../usage-tracker'

describe('estimateCost', () => {
  it('回 0 當 model 為 undefined', () => {
    expect(estimateCost(undefined, 1000, 500)).toBe(0)
  })

  it('回 0 當 model 不在 PRICING 表中', () => {
    expect(estimateCost('unknown-model', 1000, 500)).toBe(0)
  })

  it('Gemini Flash: 1M input + 1M output = 0.30 + 2.50 = 2.80', () => {
    const cost = estimateCost('gemini-2.5-flash', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(2.8, 5)
  })

  it('Claude Haiku: 1M input + 1M output = 0.80 + 4.00 = 4.80', () => {
    const cost = estimateCost('claude-3-5-haiku-20241022', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(4.8, 5)
  })

  it('Claude Sonnet: 1M input + 1M output = 3.00 + 15.00 = 18.00', () => {
    const cost = estimateCost('claude-sonnet-4-6', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(18.0, 5)
  })

  it('Flux per-image 不依 tokens：固定 $0.008', () => {
    expect(estimateCost('flux-pro', 0, 0)).toBeCloseTo(0.008, 5)
    expect(estimateCost('flux-pro', 99999, 99999)).toBeCloseTo(0.008, 5)
  })

  it('Embedding-only 模型：output 0 即可', () => {
    const cost = estimateCost('text-embedding-3-small', 1_000_000)
    expect(cost).toBeCloseTo(0.02, 5)
  })

  it('真實場景 Gemini Flash 文章生成：~3000 in, ~2000 out', () => {
    const cost = estimateCost('gemini-2.5-flash', 3000, 2000)
    // 3000/1M * 0.30 + 2000/1M * 2.50 = 0.0009 + 0.005 = 0.0059
    expect(cost).toBeCloseTo(0.0059, 7)
  })

  it('部分 token 缺值時使用 0 補', () => {
    expect(estimateCost('gemini-2.5-flash', undefined, 1000)).toBeCloseTo(0.0025, 7)
    expect(estimateCost('gemini-2.5-flash', 1000, undefined)).toBeCloseTo(0.0003, 7)
    expect(estimateCost('gemini-2.5-flash')).toBe(0)
  })
})
