/**
 * Snake_case ↔ camelCase 轉換工具
 *
 * 動機：DB (PostgREST / Supabase) 欄位用 snake_case，JS 慣例 camelCase。
 * 目前專案散落 `a.source_published_at` 與 `a.createdAt` 混用，
 * 這支 util + 薄 wrapper 讓業務層可一律 camelCase，邊界層統一轉換。
 *
 * 範圍與限制：
 * - 只轉 object keys，不碰 value
 * - 深層遞迴 array 與 plain object
 * - Date、Map、Set、class instance、Buffer 等非 plain object **不**會被遍歷
 * - 循環參照不做特殊處理（實務資料不會有）
 */

/** ab_c → abC；已經 camelCase 的字串不變 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
}

/** abC → ab_c；已是 snake_case 的字串不變 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase())
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function convertKeysDeep<T>(value: T, transform: (key: string) => string): T {
  if (Array.isArray(value)) {
    return value.map((item) => convertKeysDeep(item, transform)) as unknown as T
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[transform(k)] = convertKeysDeep(v, transform)
    }
    return out as T
  }
  return value
}

/** 深層把 object / array 內所有 key 從 snake_case 轉為 camelCase */
export function keysToCamel<T>(value: T): T {
  return convertKeysDeep(value, snakeToCamel)
}

/** 深層把 object / array 內所有 key 從 camelCase 轉為 snake_case */
export function keysToSnake<T>(value: T): T {
  return convertKeysDeep(value, camelToSnake)
}
