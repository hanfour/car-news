#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

// Levenshtein distance
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
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
      }
    }
  }

  return dp[m][n]
}

function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1.0
  const distance = levenshteinDistance(str1, str2)
  return 1.0 - distance / maxLen
}

async function analyzeGroup(articleIds: string[]) {
  const supabase = createServiceClient()

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, created_at, published')
    .in('id', articleIds)
    .order('created_at', { ascending: true })

  if (!articles || articles.length === 0) {
    console.log('❌ 無法獲取文章')
    return
  }

  console.log('📊 重複文章組分析\n')
  console.log('='.repeat(80))

  // 顯示文章列表
  console.log('\n【文章列表】\n')
  articles.forEach((article, idx) => {
    console.log(`${idx + 1}. [${article.id}] ${article.published ? '✓' : '✗'} ${article.title_zh}`)
    console.log(`   時間: ${new Date(article.created_at).toLocaleString('zh-TW')}`)
    console.log(`   長度: ${article.content_zh?.length || 0} 字`)
  })

  // 兩兩比較相似度
  console.log('\n' + '='.repeat(80))
  console.log('\n【相似度矩陣】\n')

  const matrix: number[][] = Array(articles.length).fill(null).map(() => Array(articles.length).fill(0))

  for (let i = 0; i < articles.length; i++) {
    for (let j = 0; j < articles.length; j++) {
      if (i === j) {
        matrix[i][j] = 100
      } else if (i < j) {
        const titleSim = stringSimilarity(
          articles[i].title_zh.toLowerCase(),
          articles[j].title_zh.toLowerCase()
        )

        const preview1 = articles[i].content_zh?.substring(0, 500) || ''
        const preview2 = articles[j].content_zh?.substring(0, 500) || ''
        const contentSim = stringSimilarity(preview1, preview2)

        // 平均相似度
        const avgSim = (titleSim + contentSim) / 2
        matrix[i][j] = avgSim * 100
        matrix[j][i] = avgSim * 100
      }
    }
  }

  // 打印矩陣
  console.log('       ', articles.map((a, i) => `${i + 1}     `).join(''))
  matrix.forEach((row, i) => {
    const values = row.map(v => `${v.toFixed(0)}%`.padEnd(6)).join('')
    console.log(`${i + 1}.     ${values}`)
  })

  // 計算平均相似度
  let totalSim = 0
  let count = 0
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      totalSim += matrix[i][j]
      count++
    }
  }
  const avgSimilarity = totalSim / count

  console.log('\n' + '='.repeat(80))
  console.log(`\n📈 統計結果:`)
  console.log(`   文章數量: ${articles.length} 篇`)
  console.log(`   平均相似度: ${avgSimilarity.toFixed(1)}%`)
  console.log(`   時間跨度: ${getTimeSpan(articles)}`)

  // 找出最相似的一對
  let maxSim = 0
  let maxPair = [0, 0]
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      if (matrix[i][j] > maxSim) {
        maxSim = matrix[i][j]
        maxPair = [i, j]
      }
    }
  }

  console.log(`   最相似對: #${maxPair[0] + 1} vs #${maxPair[1] + 1} (${maxSim.toFixed(1)}%)`)

  // 判斷
  console.log('\n' + '='.repeat(80))
  console.log('\n【判斷】\n')

  if (avgSimilarity > 60) {
    console.log('🚨 這是嚴重的重複內容！')
    console.log('\n原因分析:')
    console.log('  • 同一新聞事件在短時間內被多次抓取')
    console.log('  • 防重機制未能有效阻止')
    console.log('  • Topic Lock 可能失效或未覆蓋此話題')

    console.log('\n建議處理:')
    console.log('  1. 保留最佳的一篇（通常是第一篇或內容最豐富的）')
    console.log('  2. 將其餘文章設為 unpublished')
    console.log('  3. 檢查並修復防重機制')

    // 找出最佳保留
    const best = articles.reduce((prev, curr) =>
      (curr.content_zh?.length || 0) > (prev.content_zh?.length || 0) ? curr : prev
    )

    console.log(`\n推薦保留: [${best.id}] ${best.title_zh}`)
    console.log(`  原因: 內容最豐富 (${best.content_zh?.length} 字)`)

    console.log('\n需要下線的文章:')
    articles.forEach(a => {
      if (a.id !== best.id && a.published) {
        console.log(`  • ${a.id} - ${a.title_zh}`)
      }
    })

  } else if (avgSimilarity > 40) {
    console.log('⚠️  文章相似但仍有差異')
    console.log('建議: 人工審核決定是否保留')
  } else {
    console.log('✅ 相似度可接受')
  }

  console.log('\n' + '='.repeat(80))
}

function getTimeSpan(articles: any[]): string {
  if (articles.length < 2) return 'N/A'

  const times = articles.map(a => new Date(a.created_at).getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)
  const diff = max - min

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours} 小時 ${minutes} 分鐘`
}

// 執行
const ids = process.argv.slice(2)
if (ids.length === 0) {
  console.log('用法: npx tsx scripts/analyze-duplicate-group.ts <id1> <id2> ...')
  process.exit(1)
}

analyzeGroup(ids).catch(console.error)
