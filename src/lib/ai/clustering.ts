import { RawArticle, ArticleCluster } from '@/types/database'
import { cosineSimilarity } from './embeddings'

export async function clusterArticles(
  articles: RawArticle[],
  minClusterSize: number = 3,
  similarityThreshold: number = 0.7
): Promise<ArticleCluster[]> {
  if (articles.length < minClusterSize) {
    return []
  }

  const clusters: ArticleCluster[] = []
  const used = new Set<string>()

  // 简单的贪心聚类算法
  for (let i = 0; i < articles.length; i++) {
    if (used.has(articles[i].id)) continue

    const cluster: RawArticle[] = [articles[i]]
    used.add(articles[i].id)

    // 找到相似的文章
    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(articles[j].id)) continue

      const similarity = cosineSimilarity(
        articles[i].embedding,
        articles[j].embedding
      )

      if (similarity >= similarityThreshold) {
        cluster.push(articles[j])
        used.add(articles[j].id)
      }
    }

    // 只保留足够大的聚类
    if (cluster.length >= minClusterSize) {
      // 计算聚类中心
      const centroid = calculateCentroid(cluster.map(a => a.embedding))

      // 计算平均相似度
      const avgSimilarity = calculateAverageSimilarity(cluster)

      clusters.push({
        articles: cluster,
        centroid,
        similarity: avgSimilarity
      })
    }
  }

  return clusters
}

function calculateCentroid(embeddings: number[][]): number[] {
  const dim = embeddings[0].length
  const centroid = new Array(dim).fill(0)

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i]
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length
  }

  return centroid
}

function calculateAverageSimilarity(articles: RawArticle[]): number {
  if (articles.length < 2) return 1

  let totalSimilarity = 0
  let count = 0

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      totalSimilarity += cosineSimilarity(
        articles[i].embedding,
        articles[j].embedding
      )
      count++
    }
  }

  return totalSimilarity / count
}
