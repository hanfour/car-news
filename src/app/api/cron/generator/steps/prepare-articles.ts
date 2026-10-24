import type { SupabaseClient } from '@supabase/supabase-js'
import {
  embedManyWithProvider,
  generateEmbedding,
  type EmbeddingProvider,
} from '@/lib/ai/embeddings'
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

export interface PrepareArticlesOptions {
  /**
   * primary：照舊，缺向量的用主要 provider 補並寫回資料庫。
   * fallback：主要 provider 不可用。向量改用備援 provider 產生，**只留在記憶體、不寫回資料庫**，
   * 因為不同模型的向量不能互相比較，混進資料庫會讓之後的分群與重複比對全部失準。
   */
  embeddingMode?: 'primary' | 'fallback'
  fallbackProvider?: EmbeddingProvider | null
}

/** 降級模式一輪最多重新嵌入幾篇（取最新的），控制時間與費用。 */
export const FALLBACK_MAX_ARTICLES = 1200
/** 降級模式只取標題加內文前段，足以分群，也比較省。 */
const FALLBACK_TEXT_CHARS = 2000

async function embedInMemory(
  articles: RawArticle[],
  provider: EmbeddingProvider
): Promise<RawArticle[]> {
  const newest = [...articles]
    .sort((a, b) => Date.parse(b.scraped_at) - Date.parse(a.scraped_at))
    .slice(0, FALLBACK_MAX_ARTICLES)
  const vectors = await embedManyWithProvider(
    provider,
    newest.map((a) => `${a.title}\n${a.content}`.slice(0, FALLBACK_TEXT_CHARS))
  )
  newest.forEach((article, index) => {
    article.embedding = vectors[index]
  })
  return newest
}

export async function prepareRawArticles(
  supabase: SupabaseClient,
  options: PrepareArticlesOptions = {}
): Promise<PrepareArticlesResult> {
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

  if (options.embeddingMode === 'fallback') {
    if (!options.fallbackProvider) {
      throw new Error('Embedding fallback mode requires a fallback provider')
    }
    const embedded = await embedInMemory(carArticles, options.fallbackProvider)
    logger.warn('generator.prepare.embed_fallback_in_memory', {
      provider: options.fallbackProvider,
      embedded: embedded.length,
      dropped: carArticles.length - embedded.length,
    })
    return { rawCount, filteredCount, carArticles: embedded, embeddingFailures: 0 }
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
