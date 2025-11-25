#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'

// Levenshtein distance for similarity
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

async function checkArticles() {
  const supabase = createServiceClient()

  const articleIds = ['jtZ4zTr', 'mHNNoHo', '2Ly1pyl']

  console.log('🔍 檢查文章問題...\n')

  for (const id of articleIds) {
    const { data: article, error } = await supabase
      .from('generated_articles')
      .select('id, title_zh, cover_image, images, created_at, content_zh')
      .eq('id', id)
      .single()

    if (error) {
      console.error(`❌ ${id}: 查詢失敗 -`, error.message)
      continue
    }

    console.log(`\n【文章 ${id}】`)
    console.log(`標題: ${article.title_zh}`)
    console.log(`創建時間: ${new Date(article.created_at).toLocaleString('zh-TW')}`)
    console.log(`封面圖: ${article.cover_image || 'N/A'}`)
    console.log(`圖片數量: ${article.images?.length || 0}`)

    if (article.images && article.images.length > 0) {
      console.log(`前3張圖片:`)
      article.images.slice(0, 3).forEach((img: string, idx: number) => {
        console.log(`  ${idx + 1}. ${img}`)
      })
    }

    console.log(`內容長度: ${article.content_zh?.length || 0} 字符`)
    console.log(`內容預覽: ${article.content_zh?.substring(0, 150)}...`)
    console.log('-'.repeat(80))
  }

  // 比較重複度
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, created_at')
    .in('id', ['mHNNoHo', '2Ly1pyl'])

  if (articles && articles.length === 2) {
    const [a1, a2] = articles
    console.log(`\n\n📊 重複度分析: ${a1.id} vs ${a2.id}`)
    console.log(`標題 1: ${a1.title_zh}`)
    console.log(`標題 2: ${a2.title_zh}`)

    // 標題相似度
    const titleSim = stringSimilarity(
      a1.title_zh.toLowerCase().trim(),
      a2.title_zh.toLowerCase().trim()
    )
    console.log(`標題相似度: ${(titleSim * 100).toFixed(1)}%`)

    // 內容相似度 (前500字)
    let contentSim = 0
    if (a1.content_zh && a2.content_zh) {
      const preview1 = a1.content_zh.substring(0, 500)
      const preview2 = a2.content_zh.substring(0, 500)
      contentSim = stringSimilarity(preview1, preview2)
      console.log(`內容相似度 (前500字): ${(contentSim * 100).toFixed(1)}%`)
    }

    const timeDiff = Math.abs(new Date(a1.created_at).getTime() - new Date(a2.created_at).getTime())
    console.log(`時間差: ${Math.round(timeDiff / 1000 / 60)} 分鐘`)

    // 判斷是否重複
    if (titleSim > 0.85 || (titleSim > 0.7 && contentSim > 0.7)) {
      console.log(`\n⚠️  這兩篇文章確實重複！`)
      console.log(`建議: 刪除較新的文章 (保留較舊的)`)
    } else {
      console.log(`\n✅ 相似度在可接受範圍內`)
    }
  }
}

checkArticles().catch(console.error)
