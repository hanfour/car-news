/**
 * In-memory sliding window rate limiter
 * 每個 serverless instance 獨立計數，重啟歸零
 */

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

const store = new Map<string, number[]>()

// 定期 GC 防止記憶體洩漏（每 60 秒清理過期 entries）
let gcInterval: ReturnType<typeof setInterval> | null = null

function ensureGC() {
  if (gcInterval) return
  gcInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamps] of store) {
      const valid = timestamps.filter((t) => t > now - 120_000)
      if (valid.length === 0) {
        store.delete(key)
      } else {
        store.set(key, valid)
      }
    }
    if (store.size === 0 && gcInterval) {
      clearInterval(gcInterval)
      gcInterval = null
    }
  }, 60_000)
  // 不阻擋 process 結束
  if (gcInterval && typeof gcInterval === 'object' && 'unref' in gcInterval) {
    gcInterval.unref()
  }
}

export function rateLimit(
  key: string,
  { maxRequests, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs

  // 取得並清理過期 timestamps
  const timestamps = (store.get(key) || []).filter((t) => t > windowStart)

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0]
    store.set(key, timestamps)
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    }
  }

  timestamps.push(now)
  store.set(key, timestamps)
  ensureGC()

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    resetAt: now + windowMs,
  }
}
