/**
 * 法律合规相似度检测工具
 *
 * 目标：确保生成内容与来源文章相似度 < 30%
 *
 * 检测维度：
 * 1. N-gram 相似度 - 检测复制的短语
 * 2. Jaccard 相似度 - 检测词汇重叠
 * 3. 结构相似度 - 检测段落顺序
 */

export interface SimilarityResult {
  /** 总相似度分数 (0-1) */
  overallSimilarity: number
  /** 是否通过合规检查 (<30% 相似度) */
  isCompliant: boolean
  /** 详细指标 */
  metrics: {
    /** N-gram 相似度 (检测短语复制) */
    ngramSimilarity: number
    /** Jaccard 相似度 (词汇重叠) */
    jaccardSimilarity: number
    /** 最长公共子序列比例 */
    lcsRatio: number
  }
  /** 警告信息 */
  warnings: string[]
}

/**
 * 中文文本分词（简单版，按字符和标点分割）
 */
function tokenize(text: string): string[] {
  // 移除多余空白和换行
  const cleaned = text.replace(/\s+/g, ' ').trim()

  // 按中文标点和空格分割，保留有意义的词
  const tokens = cleaned
    .split(/[，。！？、；：""''（）【】\s]+/)
    .filter(t => t.length > 0)

  return tokens
}

/**
 * 生成 N-gram
 */
function generateNgrams(tokens: string[], n: number): Set<string> {
  const ngrams = new Set<string>()

  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join('')
    ngrams.add(ngram)
  }

  return ngrams
}

/**
 * 计算 N-gram 相似度
 * 使用 Jaccard 系数：交集/并集
 */
function calculateNgramSimilarity(text1: string, text2: string, n: number = 3): number {
  const tokens1 = tokenize(text1)
  const tokens2 = tokenize(text2)

  if (tokens1.length < n || tokens2.length < n) {
    return 0
  }

  const ngrams1 = generateNgrams(tokens1, n)
  const ngrams2 = generateNgrams(tokens2, n)

  // 计算交集大小
  let intersection = 0
  for (const ngram of ngrams1) {
    if (ngrams2.has(ngram)) {
      intersection++
    }
  }

  // Jaccard 系数
  const union = ngrams1.size + ngrams2.size - intersection

  if (union === 0) return 0
  return intersection / union
}

/**
 * 计算词汇 Jaccard 相似度
 */
function calculateJaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1))
  const tokens2 = new Set(tokenize(text2))

  let intersection = 0
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersection++
    }
  }

  const union = tokens1.size + tokens2.size - intersection

  if (union === 0) return 0
  return intersection / union
}

/**
 * 计算最长公共子序列 (LCS) 比例
 * 用于检测是否保留了来源的句子顺序
 */
function calculateLCSRatio(text1: string, text2: string): number {
  const sentences1 = text1.split(/[。！？]/).filter(s => s.trim().length > 5)
  const sentences2 = text2.split(/[。！？]/).filter(s => s.trim().length > 5)

  if (sentences1.length === 0 || sentences2.length === 0) {
    return 0
  }

  // 使用句子的前10个字符作为简化的比较单位
  const keys1 = sentences1.map(s => s.trim().slice(0, 10))
  const keys2 = sentences2.map(s => s.trim().slice(0, 10))

  // 计算 LCS 长度
  const m = keys1.length
  const n = keys2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (keys1[i - 1] === keys2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const lcsLength = dp[m][n]
  const maxLength = Math.max(m, n)

  return lcsLength / maxLength
}

/**
 * 检测生成内容与来源的相似度
 *
 * @param generatedContent 生成的文章内容
 * @param sourcesContent 来源文章内容数组
 * @param threshold 合规阈值，默认 0.3 (30%)
 */
export function checkContentSimilarity(
  generatedContent: string,
  sourcesContent: string[],
  threshold: number = 0.3
): SimilarityResult {
  const warnings: string[] = []

  // 合并所有来源内容
  const combinedSource = sourcesContent.join('\n\n')

  // 计算各项指标
  const ngramSimilarity = calculateNgramSimilarity(generatedContent, combinedSource, 3)
  const jaccardSimilarity = calculateJaccardSimilarity(generatedContent, combinedSource)
  const lcsRatio = calculateLCSRatio(generatedContent, combinedSource)

  // 加权计算总相似度
  // N-gram 权重最高（检测短语复制）
  // LCS 权重次之（检测结构复制）
  // Jaccard 权重最低（词汇重叠是正常的）
  const overallSimilarity =
    ngramSimilarity * 0.5 +
    lcsRatio * 0.3 +
    jaccardSimilarity * 0.2

  // 生成警告
  if (ngramSimilarity > 0.4) {
    warnings.push(`⚠️ N-gram 相似度过高 (${(ngramSimilarity * 100).toFixed(1)}%)：可能存在短语复制`)
  }

  if (lcsRatio > 0.5) {
    warnings.push(`⚠️ 结构相似度过高 (${(lcsRatio * 100).toFixed(1)}%)：段落顺序可能与来源相同`)
  }

  if (jaccardSimilarity > 0.6) {
    warnings.push(`⚠️ 词汇重叠度高 (${(jaccardSimilarity * 100).toFixed(1)}%)：建议使用更多同义词替换`)
  }

  const isCompliant = overallSimilarity < threshold

  if (!isCompliant) {
    warnings.push(`❌ 总相似度 ${(overallSimilarity * 100).toFixed(1)}% 超过阈值 ${threshold * 100}%`)
  }

  return {
    overallSimilarity,
    isCompliant,
    metrics: {
      ngramSimilarity,
      jaccardSimilarity,
      lcsRatio
    },
    warnings
  }
}

/**
 * 检测单篇来源的最高相似度
 * 用于找出相似度最高的来源
 */
export function findMostSimilarSource(
  generatedContent: string,
  sources: Array<{ title: string; content: string; url: string }>
): {
  mostSimilar: { title: string; url: string; similarity: number } | null
  allResults: Array<{ title: string; url: string; similarity: number }>
} {
  const allResults = sources.map(source => {
    const result = checkContentSimilarity(generatedContent, [source.content])
    return {
      title: source.title,
      url: source.url,
      similarity: result.overallSimilarity
    }
  })

  // 按相似度排序
  allResults.sort((a, b) => b.similarity - a.similarity)

  return {
    mostSimilar: allResults.length > 0 ? allResults[0] : null,
    allResults
  }
}

/**
 * 格式化相似度报告
 */
export function formatSimilarityReport(result: SimilarityResult): string {
  const lines: string[] = [
    '📊 相似度检测报告',
    '═'.repeat(40),
    '',
    `总相似度: ${(result.overallSimilarity * 100).toFixed(1)}%`,
    `合规状态: ${result.isCompliant ? '✅ 通过' : '❌ 不通过'}`,
    '',
    '详细指标:',
    `  • N-gram (短语复制): ${(result.metrics.ngramSimilarity * 100).toFixed(1)}%`,
    `  • Jaccard (词汇重叠): ${(result.metrics.jaccardSimilarity * 100).toFixed(1)}%`,
    `  • LCS (结构相似): ${(result.metrics.lcsRatio * 100).toFixed(1)}%`,
  ]

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('警告:')
    for (const warning of result.warnings) {
      lines.push(`  ${warning}`)
    }
  }

  return lines.join('\n')
}
