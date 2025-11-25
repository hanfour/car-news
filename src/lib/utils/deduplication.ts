import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'

/**
 * Calculate Levenshtein distance between two strings
 * Used for title similarity detection
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Calculate title similarity (0-1 scale)
 * 1.0 = identical, 0.0 = completely different
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const len = Math.max(title1.length, title2.length)
  if (len === 0) return 1.0

  const distance = levenshteinDistance(title1, title2)
  return 1 - distance / len
}

/**
 * Check if a title is too similar to recent articles
 * Returns existing article if found, null otherwise
 */
export async function checkTitleDuplicate(
  title: string,
  windowDays: number = 2,
  similarityThreshold: number = 0.85
): Promise<{ id: string; title_zh: string; similarity: number } | null> {
  const supabase = createServiceClient()

  // Get recent articles
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - windowDays)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  const { data: recentArticles } = await supabase
    .from('generated_articles')
    .select('id, title_zh')
    .gte('created_at', cutoffStr)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!recentArticles || recentArticles.length === 0) {
    return null
  }

  // Check similarity with each article
  for (const article of recentArticles) {
    const similarity = calculateTitleSimilarity(title, article.title_zh)

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
 * Generate topic hash from cluster centroid
 * Used for topic lock mechanism
 */
export function generateTopicHash(centroid: number[]): string {
  // Convert centroid to string and hash it
  const centroidStr = centroid.join(',')

  return crypto
    .createHash('sha256')
    .update(centroidStr)
    .digest('hex')
}

/**
 * Check if a topic is locked (already generated recently)
 */
export async function checkTopicLock(
  topicHash: string,
  windowDays: number = 2
): Promise<{ locked: boolean; articleId?: string; date?: string }> {
  const supabase = createServiceClient()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - windowDays)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_topic_locks')
    .select('article_id, date')
    .eq('topic_hash', topicHash)
    .gte('date', cutoffStr)
    .single()

  if (error || !data) {
    return { locked: false }
  }

  return {
    locked: true,
    articleId: data.article_id,
    date: data.date
  }
}

/**
 * Create a topic lock for a newly generated article
 */
export async function createTopicLock(
  topicHash: string,
  articleId: string
): Promise<boolean> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('daily_topic_locks')
    .insert({
      date: today,
      topic_hash: topicHash,
      article_id: articleId
    })

  if (error) {
    console.error('[Topic Lock] Failed to create lock:', error)
    return false
  }

  return true
}

/**
 * Mark raw articles as used in a generated article
 */
export async function markRawArticlesAsUsed(
  rawArticleIds: string[],
  generatedArticleId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('raw_articles')
    .update({ used_in_article_id: generatedArticleId })
    .in('id', rawArticleIds)

  if (error) {
    console.error('[Raw Articles] Failed to mark as used:', error)
    return false
  }

  return true
}
