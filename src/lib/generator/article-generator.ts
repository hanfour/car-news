import { RawArticle } from '@/types/database'
import { generateArticleWithClaude, GenerateArticleOutput } from '@/lib/ai/claude'
import { loadPrompts } from '@/config/prompts'

export async function generateArticle(
  sourceArticles: RawArticle[]
): Promise<GenerateArticleOutput & { coverImage?: string; imageCredit?: string }> {
  const prompts = loadPrompts()

  const sources = sourceArticles.map(article => ({
    title: article.title,
    content: article.content,
    url: article.url
  }))

  const result = await generateArticleWithClaude({
    sources,
    systemPrompt: prompts.system,
    styleGuide: prompts.styleGuide
  })

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
