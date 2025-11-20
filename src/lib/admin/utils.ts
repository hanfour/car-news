import { NextRequest } from 'next/server'

/**
 * 從 Request 中提取 IP 地址
 */
export function getClientIp(request: NextRequest): string | undefined {
  // Vercel 提供的真實 IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // 其他代理
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return undefined
}

/**
 * 從 Request 中提取 User-Agent
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined
}
