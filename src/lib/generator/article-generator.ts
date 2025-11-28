import { RawArticle } from '@/types/database'
import { generateArticleWithClaude, GenerateArticleOutput } from '@/lib/ai/claude'
import { generateArticleWithGemini } from '@/lib/ai/gemini'
import { loadPrompts } from '@/config/prompts'

// 選擇使用的 AI 模型
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini' // 'claude' | 'gemini'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'flash' // 'flash' | 'pro'

export async function generateArticle(
  sourceArticles: RawArticle[]
): Promise<GenerateArticleOutput & { coverImage?: string; imageCredit?: string }> {
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
    imageCredit
  }
}
