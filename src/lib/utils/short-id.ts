import { customAlphabet } from 'nanoid'

// 使用base62字符集（0-9a-zA-Z）
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7)

export function generateShortId(): string {
  return nanoid()
}
