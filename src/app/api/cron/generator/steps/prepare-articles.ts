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

export async function prepareRawArticles(supabase: SupabaseClient): Promise<PrepareArticlesResult> {
  logger.info('generator.prepare.start')
  // 只撈尚未被用過的素材。已被用過（used_in_article_id 非空）的素材代表內容已被某篇文章涵蓋，
  // 若不排除，每次 cron 都會把它重新聚類、重新呼叫 Gemini 生成，最後又在生成後被判重複丟掉，
  // 形成同一批素材反覆付費生成的浪費（對應 route.ts markRawArticlesAsUsed 的「prevent reuse」設計）。
  const { data: rawArticles, error: fetchError } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .is('used_in_article_id', null)

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
