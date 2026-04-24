import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { filterCarArticles } from '@/lib/utils/brand-extractor'
import { RawArticle } from '@/types/database'
import { logger } from '@/lib/logger'

/**
 * Generator 的前置資料準備：抓取未過期的 raw_articles、過濾機車/不相關、為缺 embedding 的補生成。
 * 回傳的 `carArticles` 已排除機車/不相關內容，且每篇都有 embedding（除非整批 DISABLE_EMBEDDINGS）。
 */
export interface PrepareArticlesResult {
  rawCount: number
  filteredCount: number
  carArticles: RawArticle[]
  /** 補 embedding 期間失敗的次數（fetch/update 兩者合計）— 供 caller 監控 AI/DB 健康度 */
  embeddingFailures: number
}

export async function prepareRawArticles(
  supabase: SupabaseClient
): Promise<PrepareArticlesResult> {
  logger.info('generator.prepare.start')
  const { data: rawArticles, error: fetchError } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (fetchError) {
    throw new Error(`Failed to fetch articles: ${fetchError.message}`)
  }

  const rawCount = rawArticles?.length ?? 0
  if (!rawArticles || rawArticles.length < 3) {
    return { rawCount, filteredCount: 0, carArticles: [], embeddingFailures: 0 }
  }

  logger.info('generator.prepare.fetched', { count: rawArticles.length })

  const carArticles = filterCarArticles(rawArticles as RawArticle[])
  const filteredCount = rawArticles.length - carArticles.length
  if (filteredCount > 0) {
    logger.info('generator.prepare.filtered', { filteredCount })
  }

  if (carArticles.length < 3) {
    return { rawCount, filteredCount, carArticles: [], embeddingFailures: 0 }
  }

  const disableEmbeddings = process.env.DISABLE_EMBEDDINGS === 'true'
  if (disableEmbeddings) {
    logger.warn('generator.prepare.embeddings_disabled')
    return { rawCount, filteredCount, carArticles, embeddingFailures: 0 }
  }

  const articlesWithoutEmbedding = carArticles.filter((a) => !a.embedding)
  if (articlesWithoutEmbedding.length === 0) {
    return { rawCount, filteredCount, carArticles, embeddingFailures: 0 }
  }

  logger.info('generator.prepare.embed_start', { count: articlesWithoutEmbedding.length })
  let embeddingFailures = 0
  for (const article of articlesWithoutEmbedding) {
    try {
      const embedding = await generateEmbedding(article.content)
      const { error: updateError } = await supabase
        .from('raw_articles')
        .update({ embedding })
        .eq('id', article.id)

      if (updateError) {
        embeddingFailures++
        logger.error('generator.prepare.embed_update_fail', updateError, { url: article.url })
      } else {
        article.embedding = embedding
      }
    } catch (error) {
      embeddingFailures++
      logger.error('generator.prepare.embed_generate_fail', error, { url: article.url })
    }
  }
  logger.info('generator.prepare.embed_done', {
    attempted: articlesWithoutEmbedding.length,
    failures: embeddingFailures,
  })

  return { rawCount, filteredCount, carArticles, embeddingFailures }
}
