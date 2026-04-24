/**
 * Timing-safe string comparison using Web Crypto API.
 * Works in both Node.js and Edge Runtime.
 * Uses HMAC-SHA256 on both inputs with a common key so an attacker cannot
 * learn secret bytes by observing early-exit timing.
 */
export async function secureCompare(a: string, b: string): Promise<boolean> {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  // WebCrypto importKey 不接受 zero-length key；兩者都為空則等長且內容相同
  if (a.length === 0) return true

  const encoder = new TextEncoder()
  const keyData = encoder.encode(a)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig1 = await crypto.subtle.sign('HMAC', key, encoder.encode(a))
  const sig2 = await crypto.subtle.sign('HMAC', key, encoder.encode(b))
  const arr1 = new Uint8Array(sig1)
  const arr2 = new Uint8Array(sig2)
  if (arr1.length !== arr2.length) return false

  let result = 0
  for (let i = 0; i < arr1.length; i++) {
    result |= arr1[i] ^ arr2[i]
  }
  return result === 0
}
