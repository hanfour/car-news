#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'

// 计算字符串相似度（Levenshtein距离）
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

// 计算余弦相似度
function cosineSimilarity(vec1: number[], vec2: number[]): number {
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

interface Article {
  id: string
  title_zh: string
  content_zh: string
  brands?: string[]
  embedding?: number[]
  created_at: string
  published_at?: string
}

interface DuplicateGroup {
  articles: Article[]
  titleSimilarity?: number
  contentSimilarity?: number
  reason: string
}

async function analyzeDuplicates() {
  console.log('🔍 开始分析最近2天的文章重复情况...\n')

  const supabase = createServiceClient()

  // 获取最近2天的文章
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, brands, created_at, published_at')
    .gte('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  if (!articles || articles.length === 0) {
    console.log('📭 最近2天没有生成的文章')
    return
  }

  console.log(`📊 总文章数: ${articles.length}`)
  console.log(`📅 时间范围: ${twoDaysAgo.toISOString()} 至 ${new Date().toISOString()}\n`)

  // 存储重复组
  const duplicateGroups: DuplicateGroup[] = []
  const processedIds = new Set<string>()

  // 比较所有文章对
  for (let i = 0; i < articles.length; i++) {
    if (processedIds.has(articles[i].id)) continue

    const group: Article[] = [articles[i]]

    for (let j = i + 1; j < articles.length; j++) {
      if (processedIds.has(articles[j].id)) continue

      const article1 = articles[i]
      const article2 = articles[j]

      // 1. 标题相似度检查
      const titleSim = stringSimilarity(
        article1.title_zh.toLowerCase().trim(),
        article2.title_zh.toLowerCase().trim()
      )

      // 2. 内容前200字符相似度检查
      let contentSim = 0
      if (article1.content_zh && article2.content_zh) {
        const preview1 = article1.content_zh.substring(0, 500)
        const preview2 = article2.content_zh.substring(0, 500)
        contentSim = stringSimilarity(preview1, preview2)
      }

      // 判断是否重复
      let isDuplicate = false
      let reason = ''

      if (titleSim > 0.85) {
        isDuplicate = true
        reason = `标题高度相似 (${(titleSim * 100).toFixed(1)}%)`
      } else if (contentSim > 0.85) {
        isDuplicate = true
        reason = `内容开头相似 (${(contentSim * 100).toFixed(1)}%)`
      } else if (titleSim > 0.7 && contentSim > 0.7) {
        isDuplicate = true
        reason = `标题+内容相似 (标题${(titleSim * 100).toFixed(1)}%, 内容${(contentSim * 100).toFixed(1)}%)`
      }

      if (isDuplicate) {
        group.push(article2)
        processedIds.add(article2.id)

        // 更新或创建重复组
        const existingGroup = duplicateGroups.find(g => g.articles.includes(article1))
        if (existingGroup) {
          if (!existingGroup.articles.includes(article2)) {
            existingGroup.articles.push(article2)
          }
        } else if (group.length === 2) {
          duplicateGroups.push({
            articles: [...group],
            titleSimilarity: titleSim,
            contentSimilarity: contentSim,
            reason
          })
        }
      }
    }

    if (group.length > 1) {
      processedIds.add(articles[i].id)
    }
  }

  // 输出结果
  console.log(`\n🔎 发现重复组数: ${duplicateGroups.length}`)
  console.log(`📈 重复文章数: ${Array.from(processedIds).length}`)
  console.log(`📊 重复比例: ${((Array.from(processedIds).length / articles.length) * 100).toFixed(1)}%\n`)

  if (duplicateGroups.length > 0) {
    console.log('=' .repeat(80))
    console.log('详细重复案例:\n')

    duplicateGroups.forEach((group, index) => {
      console.log(`\n【重复组 ${index + 1}】 - ${group.reason}`)
      console.log('-'.repeat(80))

      group.articles.forEach((article, idx) => {
        console.log(`\n  文章 ${idx + 1}:`)
        console.log(`  ID: ${article.id}`)
        console.log(`  标题: ${article.title_zh}`)
        console.log(`  品牌: ${article.brands?.join(', ') || 'N/A'}`)
        console.log(`  创建时间: ${new Date(article.created_at).toLocaleString('zh-CN')}`)
        console.log(`  发布状态: ${article.published_at ? '已发布' : '未发布'}`)
        console.log(`  内容长度: ${article.content_zh?.length || 0} 字符`)

        // 显示内容前200字符
        if (article.content_zh) {
          const preview = article.content_zh.substring(0, 200).replace(/\n/g, ' ')
          console.log(`  内容预览: ${preview}...`)
        }
      })

      console.log('\n' + '-'.repeat(80))
    })
  }

  // 品牌分布统计
  console.log('\n\n📊 品牌分布统计:')
  console.log('='.repeat(80))
  const brandCounts = new Map<string, number>()
  articles.forEach(a => {
    if (a.brands && a.brands.length > 0) {
      a.brands.forEach((brand: string) => {
        brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1)
      })
    } else {
      brandCounts.set('未知', (brandCounts.get('未知') || 0) + 1)
    }
  })

  Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => {
      const percentage = ((count / articles.length) * 100).toFixed(1)
      console.log(`  ${brand}: ${count} 篇 (${percentage}%)`)
    })

  // 改进建议
  console.log('\n\n💡 改进建议:')
  console.log('='.repeat(80))

  if (duplicateGroups.length > 0) {
    console.log('\n1. **立即行动**:')
    console.log('   - 删除或下线重复文章(保留质量最好的一篇)')
    console.log('   - 审查文章生成逻辑,找出重复原因')

    console.log('\n2. **生成阶段防重**:')
    console.log('   - 在生成新文章前,检查最近N天内是否有相似标题')
    console.log('   - 使用 embedding 向量相似度检测内容重复')
    console.log('   - 建议阈值: 标题相似度 < 0.7, embedding相似度 < 0.8')

    console.log('\n3. **话题锁定机制**:')
    console.log('   - 对已生成过的话题加锁(24-48小时)')
    console.log('   - 记录话题关键词,避免同一话题多次生成')

    console.log('\n4. **品牌多样性**:')
    const topBrand = Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    if (topBrand && topBrand[1] / articles.length > 0.3) {
      console.log(`   - 当前 ${topBrand[0]} 占比 ${((topBrand[1] / articles.length) * 100).toFixed(1)}% 过高`)
      console.log('   - 增加其他品牌的文章生成比例')
    }

    console.log('\n5. **数据库索引优化**:')
    console.log('   - 在 title 字段上创建 GIN 索引(全文搜索)')
    console.log('   - 在 embedding 字段上创建向量索引(加速相似度查询)')

  } else {
    console.log('\n✅ 未发现明显重复文章,当前去重机制工作正常')
    console.log('   - 继续保持现有的防重策略')
    console.log('   - 建议定期运行此脚本监控')
  }

  console.log('\n' + '='.repeat(80))
  console.log('分析完成!\n')
}

analyzeDuplicates().catch(console.error)
