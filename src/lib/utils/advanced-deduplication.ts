/**
 * 進階防重系統
 * 1. Embedding 語義相似度檢測
 * 2. 品牌頻率限制
 * 3. 話題關鍵詞檢測
 */

import { createServiceClient } from '@/lib/supabase'

/**
 * 計算 embedding 餘弦相似度
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * 檢查 embedding 語義重複
 * 使用餘弦相似度比較文章的 embedding 向量
 *
 * @param newEmbedding 新文章的 embedding
 * @param brand 品牌名稱
 * @param windowDays 檢查窗口（天數）
 * @param similarityThreshold 相似度閾值（預設 0.90）
 * @returns 如果發現重複，返回重複文章信息
 */
export async function checkEmbeddingSimilarity(
  newEmbedding: number[],
  brand: string,
  windowDays: number = 3,
  similarityThreshold: number = 0.90
): Promise<{ id: string; title_zh: string; similarity: number } | null> {
  const supabase = createServiceClient()

  const windowDate = new Date()
  windowDate.setDate(windowDate.getDate() - windowDays)

  // 獲取最近同品牌的已發布文章（含 embedding）
  const { data: recentArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, embedding')
    .eq('published', true)
    .eq('primary_brand', brand)
    .gte('published_at', windowDate.toISOString())
    .not('embedding', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20)

  if (error || !recentArticles || recentArticles.length === 0) {
    return null
  }

  // 比較每篇文章的 embedding
  for (const article of recentArticles) {
    const similarity = cosineSimilarity(newEmbedding, article.embedding as number[])

    if (similarity >= similarityThreshold) {
      console.log(`[Embedding Check] High similarity detected: ${(similarity * 100).toFixed(1)}%`)
      return {
        id: article.id,
        title_zh: article.title_zh,
        similarity
      }
    }
  }

  return null
}

/**
 * 檢查品牌文章生成頻率
 * 防止短時間內同一品牌過多文章
 *
 * @param brand 品牌名稱
 * @param windowHours 時間窗口（小時）
 * @param maxArticles 最大文章數
 * @returns 是否超過限制
 */
export async function checkBrandFrequency(
  brand: string,
  windowHours: number = 24,
  maxArticles: number = 3
): Promise<{ exceeded: boolean; count: number; recentArticles: any[] }> {
  const supabase = createServiceClient()

  const windowDate = new Date()
  windowDate.setHours(windowDate.getHours() - windowHours)

  const { data: recentArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, created_at')
    .eq('primary_brand', brand)
    .gte('created_at', windowDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Brand Frequency] Query error:', error)
    return { exceeded: false, count: 0, recentArticles: [] }
  }

  const count = recentArticles?.length || 0
  const exceeded = count >= maxArticles

  if (exceeded) {
    console.log(`[Brand Frequency] ${brand} exceeded limit: ${count}/${maxArticles} in ${windowHours}h`)
  }

  return {
    exceeded,
    count,
    recentArticles: recentArticles || []
  }
}

/**
 * 提取文章關鍵詞（簡易版）
 * 從標題中提取核心關鍵詞
 */
export function extractKeywords(title: string): string[] {
  // 移除常見詞
  const stopWords = ['的', '與', '和', '或', '是', '在', '將', '為', '了', '年', '月', '日']

  // 提取中文詞（簡易分詞）
  const words = title.match(/[\u4e00-\u9fa5]+/g) || []

  // 過濾停用詞和短詞
  const keywords = words
    .filter(word => word.length >= 2 && !stopWords.includes(word))
    .slice(0, 5) // 最多5個關鍵詞

  // 提取數字和英文
  const numbers = title.match(/\d{4}/g) || [] // 年份
  const english = title.match(/[A-Z][A-Za-z0-9]+/g) || [] // 品牌、型號

  return Array.from(new Set([...keywords, ...numbers, ...english]))
}

/**
 * 檢查話題關鍵詞重複
 * 比較關鍵詞重疊度
 *
 * @param newTitle 新文章標題
 * @param brand 品牌名稱
 * @param windowDays 檢查窗口（天數）
 * @param overlapThreshold 重疊閾值（預設 0.7）
 * @returns 如果發現高度重疊，返回重複文章信息
 */
export async function checkKeywordOverlap(
  newTitle: string,
  brand: string,
  windowDays: number = 2,
  overlapThreshold: number = 0.7
): Promise<{ id: string; title_zh: string; overlap: number } | null> {
  const supabase = createServiceClient()

  const windowDate = new Date()
  windowDate.setDate(windowDate.getDate() - windowDays)

  const { data: recentArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh')
    .eq('primary_brand', brand)
    .gte('created_at', windowDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !recentArticles || recentArticles.length === 0) {
    return null
  }

  const newKeywords = new Set(extractKeywords(newTitle))

  for (const article of recentArticles) {
    const articleKeywords = new Set(extractKeywords(article.title_zh))

    // 計算 Jaccard 相似度
    const intersection = new Set(Array.from(newKeywords).filter(k => articleKeywords.has(k)))
    const union = new Set([...Array.from(newKeywords), ...Array.from(articleKeywords)])
    const overlap = intersection.size / union.size

    if (overlap >= overlapThreshold) {
      console.log(`[Keyword Overlap] High overlap detected: ${(overlap * 100).toFixed(1)}%`)
      console.log(`  New: ${Array.from(newKeywords).join(', ')}`)
      console.log(`  Existing: ${Array.from(articleKeywords).join(', ')}`)

      return {
        id: article.id,
        title_zh: article.title_zh,
        overlap
      }
    }
  }

  return null
}

/**
 * 綜合防重檢查
 * 整合所有防重機制
 *
 * @param params 檢查參數
 * @returns 檢查結果
 */
export async function comprehensiveDuplicateCheck(params: {
  title: string
  embedding?: number[]
  brand: string
}): Promise<{
  isDuplicate: boolean
  reason?: string
  relatedArticle?: { id: string; title_zh: string }
}> {
  const { title, embedding, brand } = params

  // 1. 品牌頻率檢查
  const frequencyCheck = await checkBrandFrequency(brand, 24, 3)
  if (frequencyCheck.exceeded) {
    return {
      isDuplicate: true,
      reason: `品牌頻率超限 (${frequencyCheck.count}/3 in 24h)`,
      relatedArticle: frequencyCheck.recentArticles[0]
    }
  }

  // 2. 關鍵詞重疊檢查
  const keywordCheck = await checkKeywordOverlap(title, brand, 2, 0.7)
  if (keywordCheck) {
    return {
      isDuplicate: true,
      reason: `關鍵詞重疊 ${(keywordCheck.overlap * 100).toFixed(0)}%`,
      relatedArticle: keywordCheck
    }
  }

  // 3. Embedding 語義相似度檢查
  if (embedding) {
    const embeddingCheck = await checkEmbeddingSimilarity(embedding, brand, 3, 0.90)
    if (embeddingCheck) {
      return {
        isDuplicate: true,
        reason: `語義相似度 ${(embeddingCheck.similarity * 100).toFixed(0)}%`,
        relatedArticle: embeddingCheck
      }
    }
  }

  return { isDuplicate: false }
}
