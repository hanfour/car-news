import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { filterCarArticles } from '@/lib/utils/brand-extractor'
import { RawArticle } from '@/types/database'

/**
 * Generator 的前置資料準備：抓取未過期的 raw_articles、過濾機車/不相關、為缺 embedding 的補生成。
 * 回傳的 `carArticles` 已排除機車/不相關內容，且每篇都有 embedding（除非整批 DISABLE_EMBEDDINGS）。
 */
export async function prepareRawArticles(supabase: SupabaseClient): Promise<{
  rawCount: number
  filteredCount: number
  carArticles: RawArticle[]
}> {
  console.log('Fetching raw articles...')
  const { data: rawArticles, error: fetchError } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (fetchError) {
    throw new Error(`Failed to fetch articles: ${fetchError.message}`)
  }

  const rawCount = rawArticles?.length ?? 0
  if (!rawArticles || rawArticles.length < 3) {
    return { rawCount, filteredCount: 0, carArticles: [] }
  }

  console.log(`Found ${rawArticles.length} articles`)

  const carArticles = filterCarArticles(rawArticles as RawArticle[])
  const filteredCount = rawArticles.length - carArticles.length
  if (filteredCount > 0) {
    console.log(`🚫 Filtered out ${filteredCount} motorcycle/irrelevant articles`)
  }

  if (carArticles.length < 3) {
    return { rawCount, filteredCount, carArticles: [] }
  }

  const disableEmbeddings = process.env.DISABLE_EMBEDDINGS === 'true'
  if (disableEmbeddings) {
    console.log('⚠️  Embeddings generation is disabled (DISABLE_EMBEDDINGS=true)')
    return { rawCount, filteredCount, carArticles }
  }

  const articlesWithoutEmbedding = carArticles.filter((a) => !a.embedding)
  if (articlesWithoutEmbedding.length === 0) {
    return { rawCount, filteredCount, carArticles }
  }

  console.log(`Generating embeddings for ${articlesWithoutEmbedding.length} articles...`)
  for (const article of articlesWithoutEmbedding) {
    try {
      const embedding = await generateEmbedding(article.content)
      const { error: updateError } = await supabase
        .from('raw_articles')
        .update({ embedding })
        .eq('id', article.id)

      if (updateError) {
        console.error(`Failed to update embedding for ${article.url}:`, updateError)
      } else {
        article.embedding = embedding
      }
    } catch (error) {
      console.error(`Failed to generate embedding for ${article.url}:`, error)
    }
  }
  console.log(`✓ Embeddings generated`)

  return { rawCount, filteredCount, carArticles }
}
