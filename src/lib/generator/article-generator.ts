import { RawArticle } from '@/types/database'
import { generateArticleWithClaude, GenerateArticleOutput } from '@/lib/ai/claude'
import { loadPrompts } from '@/config/prompts'

export async function generateArticle(
  sourceArticles: RawArticle[]
): Promise<GenerateArticleOutput> {
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

  return result
}
