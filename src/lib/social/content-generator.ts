/**
 * Social Media Content Generator
 * 用於為文章生成社群媒體貼文內容（100-200 字摘要）
 */

import { generateText } from '@/lib/ai/claude'

/**
 * 生成社群媒體貼文摘要
 *
 * @param articleTitle 文章標題
 * @param articleContent 文章完整內容
 * @param articleUrl 文章網址
 * @param platform 目標平台（不同平台可能有不同風格）
 * @returns 100-200 字的貼文摘要
 */
export async function generateSocialSummary(
  articleTitle: string,
  articleContent: string,
  articleUrl: string,
  platform: 'facebook' | 'instagram' | 'threads' = 'facebook'
): Promise<string> {
  // 根據平台調整風格
  const platformGuidelines = {
    facebook: '適合 Facebook 粉絲專頁的正式專業語氣',
    instagram: '適合 Instagram 的簡潔視覺化語氣，可以使用適當的表情符號',
    threads: '適合 Threads 的輕鬆對話語氣'
  }

  const prompt = `你是汽車新聞社群媒體編輯。請為以下文章撰寫一則社群媒體貼文。

**文章標題**：${articleTitle}

**文章內容**：
${articleContent.substring(0, 1500)}

**要求**：
1. 長度：100-200 字（繁體中文）
2. 風格：${platformGuidelines[platform]}
3. 必須包含：
   - 吸引讀者點擊的開頭
   - 文章核心重點（1-2 句話）
   - 引起討論的結尾（問句或行動呼籲）
4. 不要在摘要中加入連結（連結會另外附加）
5. 使用繁體中文

請直接輸出貼文內容，不要包含任何標題或說明。`

  try {
    const summary = await generateText(prompt, {
      maxTokens: 300, // 約 200 字中文
      temperature: 0.7 // 適度創意
    })

    // 確保長度在 100-200 字之間
    const trimmed = summary.trim()

    if (trimmed.length < 50) {
      throw new Error('Generated summary is too short')
    }

    // 如果超過 200 字，截斷到最後一個完整句子
    if (trimmed.length > 200) {
      const sentences = trimmed.split(/[。！？]/)
      let result = ''
      for (const sentence of sentences) {
        if ((result + sentence).length <= 200) {
          result += sentence + (sentence.length > 0 ? '。' : '')
        } else {
          break
        }
      }
      return result || trimmed.substring(0, 200) + '...'
    }

    return trimmed
  } catch (error) {
    console.error('[Content Generator] Failed to generate summary:', error)

    // Fallback: 使用文章標題加上簡單的 CTA
    const fallbackSummary = `${articleTitle}\n\n最新汽車資訊，立即查看 👇`

    if (fallbackSummary.length > 200) {
      return fallbackSummary.substring(0, 197) + '...'
    }

    return fallbackSummary
  }
}

/**
 * 生成多平台貼文內容
 *
 * @param articleTitle 文章標題
 * @param articleContent 文章內容
 * @param articleUrl 文章網址
 * @returns 各平台的貼文內容
 */
export async function generateMultiPlatformContent(
  articleTitle: string,
  articleContent: string,
  articleUrl: string
): Promise<{
  facebook: string
  instagram: string
  threads: string
}> {
  // 並行生成三個平台的內容
  const [facebook, instagram, threads] = await Promise.all([
    generateSocialSummary(articleTitle, articleContent, articleUrl, 'facebook'),
    generateSocialSummary(articleTitle, articleContent, articleUrl, 'instagram'),
    generateSocialSummary(articleTitle, articleContent, articleUrl, 'threads')
  ])

  return { facebook, instagram, threads }
}

/**
 * 格式化貼文內容（加入連結）
 *
 * @param summary 貼文摘要
 * @param articleUrl 文章網址
 * @param platform 平台
 * @returns 完整的貼文內容
 */
export function formatPostContent(
  summary: string,
  articleUrl: string,
  platform: 'facebook' | 'instagram' | 'threads'
): string {
  // Facebook: Meta 會自動產生 link preview，不需要手動加連結文字
  if (platform === 'facebook') {
    return summary
  }

  // Instagram: 連結會以 image_url 方式處理，caption 中不包含連結
  if (platform === 'instagram') {
    return summary
  }

  // Threads: 可以在文字中包含連結
  if (platform === 'threads') {
    return `${summary}\n\n📖 閱讀全文：${articleUrl}`
  }

  return summary
}

/**
 * 驗證貼文內容
 *
 * @param content 貼文內容
 * @param platform 平台
 * @returns 是否符合平台規範
 */
export function validatePostContent(
  content: string,
  platform: 'facebook' | 'instagram' | 'threads'
): { valid: boolean; error?: string } {
  // Facebook: 最多 63,206 字元（實際上遠超需求）
  if (platform === 'facebook' && content.length > 5000) {
    return { valid: false, error: 'Content too long for Facebook' }
  }

  // Instagram: Caption 最多 2,200 字元
  if (platform === 'instagram' && content.length > 2200) {
    return { valid: false, error: 'Content too long for Instagram' }
  }

  // Threads: 最多 500 字元
  if (platform === 'threads' && content.length > 500) {
    return { valid: false, error: 'Content too long for Threads (max 500 chars)' }
  }

  // 檢查是否為空
  if (content.trim().length === 0) {
    return { valid: false, error: 'Content cannot be empty' }
  }

  return { valid: true }
}
