import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * 重複文章清理 API
 *
 * 功能：
 * 1. 找出所有相似度 > 90% 的文章對
 * 2. 按品牌分組，保留每組最早的文章
 * 3. 取消發布重複的文章
 *
 * 使用方式：
 * - GET /api/debug/cleanup-duplicates?dryRun=true  (預覽模式，不實際修改)
 * - GET /api/debug/cleanup-duplicates?dryRun=false (執行清理)
 */

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0
  let dot = 0, norm1 = 0, norm2 = 0
  for (let i = 0; i < vec1.length; i++) {
    dot += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2))
}

interface Article {
  id: string
  title_zh: string
  primary_brand: string | null
  created_at: string
  content_embedding: string | number[] | null
}

interface DuplicateGroup {
  brand: string
  articles: Array<{ id: string; title: string; created_at: string }>
  maxSimilarity: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') !== 'false'
  const similarityThreshold = parseFloat(searchParams.get('threshold') || '0.90')
  const windowDays = parseInt(searchParams.get('days') || '7')

  const supabase = createServiceClient()

  // 1. 獲取最近的已發布文章
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, primary_brand, created_at, content_embedding')
    .eq('published', true)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`Checking ${articles.length} articles for duplicates...`)

  // 2. 找出所有重複對
  const duplicatePairs: Array<{
    a1: Article
    a2: Article
    similarity: number
  }> = []

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const a1 = articles[i] as Article
      const a2 = articles[j] as Article

      if (!a1.content_embedding || !a2.content_embedding) continue

      let emb1 = a1.content_embedding
      let emb2 = a2.content_embedding

      if (typeof emb1 === 'string') emb1 = JSON.parse(emb1)
      if (typeof emb2 === 'string') emb2 = JSON.parse(emb2)

      const similarity = cosineSimilarity(emb1 as number[], emb2 as number[])

      if (similarity >= similarityThreshold) {
        duplicatePairs.push({ a1, a2, similarity })
      }
    }
  }

  console.log(`Found ${duplicatePairs.length} duplicate pairs`)

  // 3. 使用 Union-Find 將重複文章分組
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
    if (root1 !== root2) parent.set(root1, root2)
  }

  for (const pair of duplicatePairs) {
    union(pair.a1.id, pair.a2.id)
  }

  // 4. 收集每個組的文章
  const groups = new Map<string, DuplicateGroup>()
  const articleMap = new Map(articles.map(a => [a.id, a as Article]))

  for (const pair of duplicatePairs) {
    const root = find(pair.a1.id)

    if (!groups.has(root)) {
      groups.set(root, {
        brand: pair.a1.primary_brand || 'Unknown',
        articles: [],
        maxSimilarity: 0
      })
    }

    const group = groups.get(root)!
    group.maxSimilarity = Math.max(group.maxSimilarity, pair.similarity)

    // 添加文章到組（去重）
    for (const a of [pair.a1, pair.a2]) {
      if (!group.articles.some(x => x.id === a.id)) {
        group.articles.push({
          id: a.id,
          title: a.title_zh,
          created_at: a.created_at
        })
      }
    }
  }

  // 5. 對每個組按創建時間排序，保留最早的
  const toUnpublish: string[] = []
  const toKeep: string[] = []
  const groupSummaries: Array<{
    brand: string
    keep: { id: string; title: string }
    unpublish: Array<{ id: string; title: string }>
    similarity: string
  }> = []

  for (const [, group] of groups) {
    // 按創建時間排序
    group.articles.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const keepArticle = group.articles[0]
    const unpublishArticles = group.articles.slice(1)

    toKeep.push(keepArticle.id)
    toUnpublish.push(...unpublishArticles.map(a => a.id))

    groupSummaries.push({
      brand: group.brand,
      keep: { id: keepArticle.id, title: keepArticle.title.slice(0, 40) },
      unpublish: unpublishArticles.map(a => ({
        id: a.id,
        title: a.title.slice(0, 40)
      })),
      similarity: (group.maxSimilarity * 100).toFixed(1) + '%'
    })
  }

  // 6. 執行清理（如果不是 dryRun）
  let unpublishResult = null
  if (!dryRun && toUnpublish.length > 0) {
    const { error: unpublishError, count } = await supabase
      .from('generated_articles')
      .update({ published: false })
      .in('id', toUnpublish)

    if (unpublishError) {
      return NextResponse.json({
        error: `Failed to unpublish: ${unpublishError.message}`
      }, { status: 500 })
    }

    unpublishResult = { count, ids: toUnpublish }
    console.log(`Unpublished ${count} duplicate articles`)
  }

  return NextResponse.json({
    dryRun,
    settings: {
      similarityThreshold: `${(similarityThreshold * 100).toFixed(0)}%`,
      windowDays
    },
    summary: {
      totalArticlesChecked: articles.length,
      duplicatePairsFound: duplicatePairs.length,
      duplicateGroupsFound: groups.size,
      articlesToKeep: toKeep.length,
      articlesToUnpublish: toUnpublish.length
    },
    groups: groupSummaries.slice(0, 50), // 只顯示前 50 組
    ...(unpublishResult ? { unpublishResult } : {})
  })
}
