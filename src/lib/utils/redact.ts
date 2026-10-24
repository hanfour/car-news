/**
 * 把字串中看起來像金鑰或權杖的片段遮蔽掉。
 *
 * 用在「要送出系統之外」的文字（告警、webhook）與錯誤訊息上。
 * 寧可多遮一點：誤判只會讓訊息少一段，漏掉則會洩漏憑證。
 */
const PATTERNS: ReadonlyArray<RegExp> = [
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API key
  /\bsk-[A-Za-z0-9_-]{16,}/g, // OpenAI / Anthropic
  /\bxai-[A-Za-z0-9]{16,}/g, // xAI
  /Bearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT
  /([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"']{8,}/gi, // URL query
]

export function redactSecrets(text: string): string {
  let out = text
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, (match: string, group?: unknown) =>
      typeof group === 'string' && match.startsWith(group) ? `${group}[REDACTED]` : '[REDACTED]'
    )
  }
  return out
}
