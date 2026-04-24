/**
 * Supabase query 結果 key 轉 camelCase 的薄 wrapper
 *
 * 動機：整份專案 DB schema 是 snake_case，業務碼想統一用 camelCase。
 * 與其在每個 component 裡手動 map，在邊界層轉一次乾淨多了。
 *
 * 用法：
 *   import { selectAsCamel } from '@/lib/supabase-camel'
 *   const { data } = await selectAsCamel(
 *     supabase.from('generated_articles').select('id, title_zh, published_at').limit(10)
 *   )
 *   // data[0].titleZh / data[0].publishedAt
 *
 * **非破壞性**：僅轉換讀取結果；INSERT / UPDATE 仍要傳 snake_case（對齊 DB）。
 * 需要「送入也 camelCase」時另外用 keysToSnake 套。本 wrapper 目前只管讀取。
 */

import { keysToCamel } from '@/lib/utils/case-convert'

interface SupabaseQueryLike<T> {
  then: Promise<{ data: T | null; error: unknown; count?: number | null }>['then']
}

interface WrappedResult<T> {
  data: T | null
  error: unknown
  count?: number | null
}

/**
 * 接任意 Supabase query builder（.select().eq().range() 等鏈結後的 thenable），
 * await 結果後深層把 data 的 key 轉成 camelCase。
 */
export async function selectAsCamel<T>(
  query: SupabaseQueryLike<T>
): Promise<WrappedResult<T>> {
  const result = (await query) as WrappedResult<T>
  return {
    ...result,
    data: result.data === null ? null : keysToCamel(result.data),
  }
}
