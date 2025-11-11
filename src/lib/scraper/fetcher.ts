import axios from 'axios'
import * as cheerio from 'cheerio'

const axiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
})

export async function fetchWebpage(url: string): Promise<string> {
  try {
    const response = await axiosInstance.get(url)
    return response.data
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error)
    throw error
  }
}

export function extractTextFromHtml(
  html: string,
  selector?: { article?: string; title?: string; content?: string }
): { title: string; content: string; imageUrl?: string } | null {
  try {
    const $ = cheerio.load(html)

    // 移除不需要的元素
    $('script, style, nav, header, footer, aside, iframe, .advertisement, .ads').remove()

    let title = ''
    let content = ''
    let imageUrl = ''

    if (selector?.title) {
      title = $(selector.title).first().text().trim()
    } else {
      // 默认策略：查找h1或meta title
      title = $('h1').first().text().trim() ||
              $('meta[property="og:title"]').attr('content') ||
              $('title').text().trim()
    }

    if (selector?.content) {
      content = $(selector.content).text().trim()
    } else {
      // 默认策略：查找article标签或main标签
      const article = $('article').first()
      const main = $('main').first()

      if (article.length > 0) {
        content = article.text()
      } else if (main.length > 0) {
        content = main.text()
      } else {
        // 最后尝试找所有p标签
        content = $('p').map((_, el) => $(el).text()).get().join('\n')
      }
    }

    // 提取第一张有意义的图片
    // 優先順序：og:image > article img > main img > first img
    imageUrl = $('meta[property="og:image"]').attr('content') || ''

    if (!imageUrl) {
      const articleImg = $('article img').first().attr('src')
      const mainImg = $('main img').first().attr('src')
      const firstImg = $('img').first().attr('src')

      imageUrl = articleImg || mainImg || firstImg || ''
    }

    // 確保圖片 URL 是完整的
    if (imageUrl && !imageUrl.startsWith('http')) {
      // 如果是相對路徑，需要補全（這裡簡化處理，實際可能需要解析 base URL）
      imageUrl = ''
    }

    // 清理空白
    content = content.replace(/\s+/g, ' ').trim()

    if (!title || !content || content.length < 200) {
      return null
    }

    return {
      title,
      content: content.slice(0, 5000),
      imageUrl: imageUrl || undefined
    }
  } catch (error) {
    console.error('Failed to extract text from HTML:', error)
    return null
  }
}
