import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error'

/**
 * 補上降級模式期間或單次失敗時留下的空向量。
 *
 * 降級模式（見 embedding-health）為了避免混用不同模型的向量，會把新文章的
 * content_embedding 存成 null。主要服務恢復後，這裡每輪補一小批，讓日後的語義重複比對
 * 仍然涵蓋這些文章。只補最近幾天的，並且第一次失敗就停手。永遠不 throw。
 */
export async function backfillMissingArticleEmbeddings(
  supabase: SupabaseClient,
  options: {
    limit?: number
    days?: number
    embed?: (text: string) => Promise<number[]>
  } = {}
): Promise<{ attempted: number; updated: number }> {
  const limit = options.limit ?? 10
  const days = options.days ?? 7
  const embed = options.embed ?? generateEmbedding
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // 中途失敗時要回報「已做了多少」，所以計數放在 try 外面。
  let attempted = 0
  let updated = 0

  try {
    const { data, error } = await supabase
      .from('generated_articles')
      .select('id, title_zh, content_zh')
      .is('content_embedding', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return { attempted: 0, updated: 0 }

    for (const row of data as Array<{ id: string; title_zh: string; content_zh: string }>) {
      attempted++
      const vector = await embed(`${row.title_zh}\n\n${row.content_zh}`)
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({ content_embedding: vector })
        .eq('id', row.id)
      if (updateError) throw new Error(updateError.message)
      updated++
    }
    logger.info('cron.generator.embedding_backfill_done', { attempted, updated })
    return { attempted, updated }
  } catch (error) {
    logger.warn('cron.generator.embedding_backfill_stopped', {
      attempted,
      updated,
      error: getErrorMessage(error),
    })
    return { attempted, updated }
  }
}
