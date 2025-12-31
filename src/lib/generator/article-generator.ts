import { RawArticle } from '@/types/database'
import { generateArticleWithClaude, GenerateArticleOutput } from '@/lib/ai/claude'
import { generateArticleWithGemini } from '@/lib/ai/gemini'
import { loadPrompts } from '@/config/prompts'
import { checkContentSimilarity, SimilarityResult } from '@/lib/utils/similarity-checker'

// 選擇使用的 AI 模型
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini' // 'claude' | 'gemini'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'flash' // 'flash' | 'pro'

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

  // 根據環境變數選擇 AI 提供商
  let result: GenerateArticleOutput

  if (AI_PROVIDER === 'gemini') {
    console.log(`→ Using Gemini ${GEMINI_MODEL} for article generation`)
    try {
      result = await generateArticleWithGemini({
        sources,
        systemPrompt: prompts.system,
        styleGuide: prompts.styleGuide
      }, GEMINI_MODEL as 'flash' | 'pro')
    } catch (error) {
      console.error('✗ Gemini failed, falling back to Claude:', error)
      result = await generateArticleWithClaude({
        sources,
        systemPrompt: prompts.system,
        styleGuide: prompts.styleGuide
      })
    }
  } else {
    console.log('→ Using Claude for article generation')
    result = await generateArticleWithClaude({
      sources,
      systemPrompt: prompts.system,
      styleGuide: prompts.styleGuide
    })
  }

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
