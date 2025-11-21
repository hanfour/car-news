import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// 計算兩個字符串的相似度（Jaccard 相似度）
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/))
  const words2 = new Set(str2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

async function findSimilarArticles() {
  console.log('\n=== 尋找相似文章 ===\n')

  // 獲取所有已發布的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, published')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ 查詢失敗：', error)
    return
  }

  console.log(`找到 ${articles?.length || 0} 篇已發布文章\n`)

  if (!articles || articles.length < 2) {
    console.log('文章數量不足，無法比較')
    return
  }

  // 找出高相似度的文章對
  const similarPairs: Array<{
    article1: any
    article2: any
    similarity: number
  }> = []

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const similarity = calculateSimilarity(
        articles[i].title_zh,
        articles[j].title_zh
      )

      // 如果相似度超過 60%，記錄下來
      if (similarity > 0.6) {
        similarPairs.push({
          article1: articles[i],
          article2: articles[j],
          similarity
        })
      }
    }
  }

  // 按相似度排序
  similarPairs.sort((a, b) => b.similarity - a.similarity)

  if (similarPairs.length === 0) {
    console.log('✅ 沒有發現高相似度的文章（相似度 > 60%）')
  } else {
    console.log(`⚠️  發現 ${similarPairs.length} 對高相似度文章：\n`)

    similarPairs.forEach((pair, index) => {
      console.log(`${index + 1}. 相似度：${(pair.similarity * 100).toFixed(1)}%`)
      console.log(`   文章 1: [${pair.article1.id}] ${pair.article1.title_zh}`)
      console.log(`          日期: ${pair.article1.published_at}`)
      console.log(`   文章 2: [${pair.article2.id}] ${pair.article2.title_zh}`)
      console.log(`          日期: ${pair.article2.published_at}`)
      console.log('')
    })
  }

  console.log('\n')
}

findSimilarArticles()
