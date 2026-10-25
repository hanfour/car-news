import { logger } from '@/lib/logger'

export interface InsertResult<T> {
  data: T | null
  error: { code?: string; message?: string } | null
}

/** migration 還沒套用時，PostgREST 回 PGRST204、Postgres 直接回 42703，訊息都會點名 ai_model。 */
function isMissingAiModelColumn(error: InsertResult<unknown>['error']): boolean {
  if (!error) return false
  const columnMissing = error.code === 'PGRST204' || error.code === '42703'
  return columnMissing && (error.message ?? '').includes('ai_model')
}

/**
 * 寫入 generated_articles。
 *
 * ai_model 欄位由 20261025_add_generated_articles_ai_model.sql 新增。還沒套用的環境
 * 會因為找不到欄位而整筆寫入失敗，讓產線停擺。所以這種錯誤退回不帶該欄位再寫一次：
 * 文章照常保存，只是少了寫稿模型的記錄。其他錯誤原樣回傳，不重試。
 */
export async function insertGeneratedArticle<T>(
  insertRow: (row: Record<string, unknown>) => PromiseLike<InsertResult<T>>,
  row: Record<string, unknown>
): Promise<InsertResult<T>> {
  const first = await insertRow(row)
  if (!isMissingAiModelColumn(first.error)) return first

  logger.warn('cron.generator.ai_model_column_missing')
  const withoutModel = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'ai_model'))
  return insertRow(withoutModel)
}
