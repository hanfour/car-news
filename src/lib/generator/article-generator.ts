import { RawArticle } from '@/types/database'
import type { GenerateArticleOutput } from '@/lib/ai/claude'
import { generateWithFallback } from '@/lib/ai/provider'
import { loadPrompts } from '@/config/prompts'
import { checkContentSimilarity } from '@/lib/utils/similarity-checker'

// 相似度检测阈值（30% = 0.3）
const SIMILARITY_THRESHOLD = 0.30

export interface GenerateArticleResult extends GenerateArticleOutput {
  coverImage?: string
  imageCredit?: string
  similarityCheck?: {
    overallSimilarity: number
    isCompliant: boolean
    warnings: string[]
  }
}

export async function generateArticle(
  sourceArticles: RawArticle[]
): Promise<GenerateArticleResult> {
  const prompts = loadPrompts()

  const sources = sourceArticles.map(article => ({
    title: article.title,
    content: article.content,
    url: article.url
  }))

  // 透過 provider 抽象層生成，內建主/備 fallback 邏輯
  const { result } = await generateWithFallback({
    sources,
    systemPrompt: prompts.system,
    styleGuide: prompts.styleGuide,
  })

  // 📊 法律合规相似度检测
  console.log('→ Running legal compliance similarity check...')
  const sourceContents = sourceArticles.map(a => a.content)
  const similarityResult = checkContentSimilarity(
    result.content_zh,
    sourceContents,
    SIMILARITY_THRESHOLD
  )

  // 输出相似度检测结果
  const similarityPct = (similarityResult.overallSimilarity * 100).toFixed(1)
  if (similarityResult.isCompliant) {
    console.log(`✓ Similarity check PASSED: ${similarityPct}% (threshold: ${SIMILARITY_THRESHOLD * 100}%)`)
  } else {
    console.warn(`⚠️ Similarity check WARNING: ${similarityPct}% exceeds threshold ${SIMILARITY_THRESHOLD * 100}%`)
    for (const warning of similarityResult.warnings) {
      console.warn(`   ${warning}`)
    }
  }

  // 選擇封面圖：從來源文章中找第一張可用的圖片
  let coverImage: string | undefined
  let imageCredit: string | undefined

  for (const article of sourceArticles) {
    if (article.image_url) {
      coverImage = article.image_url
      imageCredit = article.image_credit || undefined
      break
    }
  }

  return {
    ...result,
    coverImage,
    imageCredit,
    similarityCheck: {
      overallSimilarity: similarityResult.overallSimilarity,
      isCompliant: similarityResult.isCompliant,
      warnings: similarityResult.warnings
    }
  }
}
