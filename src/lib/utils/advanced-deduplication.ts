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
 * @param similarityThreshold 相似度閾值（預設 0.96）
 * @returns 如果發現重複，返回重複文章信息
 */
export async function checkEmbeddingSimilarity(
  newEmbedding: number[],
  brand: string,
  windowDays: number = 3,
  similarityThreshold: number = 0.96  // 提高閾值：0.90 → 0.96，只阻擋真正重複（96%+）
): Promise<{ id: string; title_zh: string; similarity: number } | null> {
  const supabase = createServiceClient()

  const windowDate = new Date()
  windowDate.setDate(windowDate.getDate() - windowDays)

  // 獲取最近同品牌的已發布文章（含 embedding）
  const { data: recentArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_embedding')
    .eq('published', true)
    .eq('primary_brand', brand)
    .gte('published_at', windowDate.toISOString())
    .not('content_embedding', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20)

  if (error || !recentArticles || recentArticles.length === 0) {
    return null
  }

  // 比較每篇文章的 embedding
  for (const article of recentArticles) {
    // 處理字串格式的 embedding（資料庫可能回傳 JSON 字串）
    let embedding = article.content_embedding
    if (typeof embedding === 'string') {
      try {
        embedding = JSON.parse(embedding)
      } catch {
        continue
      }
    }

    const similarity = cosineSimilarity(newEmbedding, embedding as number[])

    if (similarity >= similarityThreshold) {
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
): Promise<{ exceeded: boolean; count: number; recentArticles: Array<{ id: string; title_zh: string; created_at: string }> }> {
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

// ============================================
// 批量重複檢測（用於監控和清理）
// ============================================

export interface ArticleForDuplicateCheck {
  id: string
  title_zh: string
  created_at: string
  published: boolean
  view_count: number
  content_embedding?: number[] | string | null
  primary_brand?: string | null
}

export interface DuplicatePair {
  article1: { id: string; title_zh: string; brand: string | null }
  article2: { id: string; title_zh: string; brand: string | null }
  similarity: number
  keywords?: string[]
}

/**
 * 批量檢測語義重複
 * 使用 O(n²) 比較所有文章對的 embedding 相似度
 */
export function findSemanticDuplicatesInBatch(
  articles: ArticleForDuplicateCheck[],
  similarityThreshold: number = 0.90
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = []
  const articlesWithEmbedding = articles.filter(a => a.content_embedding)

  for (let i = 0; i < articlesWithEmbedding.length; i++) {
    for (let j = i + 1; j < articlesWithEmbedding.length; j++) {
      const a1 = articlesWithEmbedding[i]
      const a2 = articlesWithEmbedding[j]

      let emb1 = a1.content_embedding
      let emb2 = a2.content_embedding

      if (typeof emb1 === 'string') emb1 = JSON.parse(emb1)
      if (typeof emb2 === 'string') emb2 = JSON.parse(emb2)

      const similarity = cosineSimilarity(emb1 as number[], emb2 as number[])

      if (similarity >= similarityThreshold) {
        duplicates.push({
          article1: { id: a1.id, title_zh: a1.title_zh, brand: a1.primary_brand || null },
          article2: { id: a2.id, title_zh: a2.title_zh, brand: a2.primary_brand || null },
          similarity: Math.round(similarity * 100) / 100
        })
      }
    }
  }

  return duplicates
}

/**
 * 批量檢測關鍵詞重複
 * 只比較同品牌文章的關鍵詞重疊度
 */
export function findKeywordDuplicatesInBatch(
  articles: ArticleForDuplicateCheck[],
  overlapThreshold: number = 0.70,
  minKeywordMatches: number = 2
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = []

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const a1 = articles[i]
      const a2 = articles[j]

      // 只比較同品牌
      if (a1.primary_brand !== a2.primary_brand || !a1.primary_brand) continue

      const keywords1 = new Set(extractKeywords(a1.title_zh))
      const keywords2 = new Set(extractKeywords(a2.title_zh))

      const intersection = new Set(Array.from(keywords1).filter(k => keywords2.has(k)))
      const union = new Set([...Array.from(keywords1), ...Array.from(keywords2)])
      const overlap = intersection.size / union.size

      if (overlap >= overlapThreshold && intersection.size >= minKeywordMatches) {
        duplicates.push({
          article1: { id: a1.id, title_zh: a1.title_zh, brand: a1.primary_brand ?? null },
          article2: { id: a2.id, title_zh: a2.title_zh, brand: a2.primary_brand ?? null },
          similarity: Math.round(overlap * 100) / 100,
          keywords: Array.from(intersection)
        })
      }
    }
  }

  return duplicates
}

export interface DuplicateGroup {
  type: 'semantic' | 'keyword'
  articles: ArticleForDuplicateCheck[]
  similarity: number
  keywords?: string[]
}

/**
 * 將成對的重複轉換為分組
 * 使用 Union-Find 算法合併有關聯的文章
 */
export function pairsToDuplicateGroups(
  pairs: DuplicatePair[],
  allArticles: ArticleForDuplicateCheck[],
  type: 'semantic' | 'keyword'
): DuplicateGroup[] {
  if (pairs.length === 0) return []

  // 建立文章 ID 到文章的映射
  const articleMap = new Map(allArticles.map(a => [a.id, a]))

  // Union-Find 結構
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id)
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!))
    }
    return parent.get(id)!
  }
  const union = (id1: string, id2: string) => {
    const root1 = find(id1)
    const root2 = find(id2)
    if (root1 !== root2) {
      parent.set(root1, root2)
    }
  }

  // 合併相關的文章
  const maxSimilarity = new Map<string, number>()
  const allKeywords = new Map<string, Set<string>>()

  for (const pair of pairs) {
    union(pair.article1.id, pair.article2.id)

    const root = find(pair.article1.id)
    maxSimilarity.set(root, Math.max(maxSimilarity.get(root) || 0, pair.similarity))

    if (pair.keywords) {
      if (!allKeywords.has(root)) allKeywords.set(root, new Set())
      pair.keywords.forEach(k => allKeywords.get(root)!.add(k))
    }
  }

  // 按組收集文章
  const groups = new Map<string, ArticleForDuplicateCheck[]>()
  for (const pair of pairs) {
    const root = find(pair.article1.id)
    if (!groups.has(root)) groups.set(root, [])

    const group = groups.get(root)!
    if (!group.some(a => a.id === pair.article1.id)) {
      const article = articleMap.get(pair.article1.id)
      if (article) group.push(article)
    }
    if (!group.some(a => a.id === pair.article2.id)) {
      const article = articleMap.get(pair.article2.id)
      if (article) group.push(article)
    }
  }

  // 轉換為 DuplicateGroup 格式
  return Array.from(groups.entries()).map(([root, articles]) => ({
    type,
    articles: articles.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    similarity: maxSimilarity.get(root) || 0,
    keywords: allKeywords.has(root) ? Array.from(allKeywords.get(root)!) : undefined
  }))
}
