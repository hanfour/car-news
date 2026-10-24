/**
 * @jest-environment node
 */
import { redactSecrets } from '../redact'

// 測試用的假憑證一律在執行時組合，避免原始碼出現完整的金鑰樣式而被掃描工具誤報。
const fake = (prefix: string, length: number) => prefix + 'x'.repeat(length)

describe('redactSecrets', () => {
  it('遮蔽 Google API key', () => {
    const out = redactSecrets(`call failed ${fake('AIza', 35)} please retry`)
    expect(out).toBe('call failed [REDACTED] please retry')
  })

  it('遮蔽 sk- 開頭的金鑰（OpenAI 與 Anthropic）', () => {
    expect(redactSecrets(fake('sk-', 30))).toBe('[REDACTED]')
    expect(redactSecrets(fake('sk-ant-', 30))).toBe('[REDACTED]')
  })

  it('遮蔽 Bearer 權杖', () => {
    expect(redactSecrets(`Authorization: Bearer ${'a'.repeat(32)}`)).toBe(
      'Authorization: [REDACTED]'
    )
  })

  it('遮蔽 JWT', () => {
    const jwt = ['eyJ' + 'a'.repeat(12), 'b'.repeat(12), 'c'.repeat(12)].join('.')
    expect(redactSecrets(`token=${jwt}`)).not.toContain(jwt)
  })

  it('保留網址 query 的參數名稱，只遮蔽值', () => {
    const out = redactSecrets('GET https://example.com/v1/embed?key=abcdefghijklmnop&alt=json')
    expect(out).toContain('?key=[REDACTED]')
    expect(out).toContain('&alt=json')
    expect(out).not.toContain('abcdefghijklmnop')
  })

  it('一般文字不受影響', () => {
    const text = 'Gemini embedding API error 402: payment required'
    expect(redactSecrets(text)).toBe(text)
  })
})
