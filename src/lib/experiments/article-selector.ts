/**
 * 測試文章選取器
 * 從 DB 選取多樣化文章作為實驗樣本
 */

import { createServiceClient } from '@/lib/supabase'
import { TestArticle } from './types'

/**
 * 從 DB 選取多樣化測試文章
 * 策略：確保不同品牌/車型都有代表
 */
export async function selectTestArticles(count: number = 10): Promise<TestArticle[]> {
  const supabase = createServiceClient()

  // 選取最近且有完整內容的文章，按品牌分散選取
  // DB 欄位名：title_zh, content_zh, brands
  const { data: rawArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, brands')
    .eq('published', true)
    .not('content_zh', 'is', null)
    .not('brands', 'is', null)
    .order('published_at', { ascending: false })
    .limit(100)

  // 映射欄位名
  const articles = (rawArticles || []).map(a => ({
    id: a.id as string,
    title: a.title_zh as string,
    content: a.content_zh as string,
    brands: a.brands as string[],
  }))

  if (error) {
    throw new Error(`Failed to fetch test articles: ${error.message}`)
  }

  if (!articles || articles.length === 0) {
    throw new Error('No published articles found for testing')
  }

  // 按品牌分組，從每個品牌中選取一篇，確保多樣性
  type MappedArticle = typeof articles[0]
  const brandMap = new Map<string, MappedArticle[]>()

  for (const article of articles) {
    const brand = article.brands?.[0] || 'unknown'
    if (!brandMap.has(brand)) {
      brandMap.set(brand, [])
    }
    brandMap.get(brand)!.push(article)
  }

  const selected: TestArticle[] = []
  const brands = Array.from(brandMap.keys())

  // Round-robin 從不同品牌選取
  let brandIdx = 0
  while (selected.length < count && selected.length < articles.length) {
    const brand = brands[brandIdx % brands.length]
    const brandArticles = brandMap.get(brand)!
    const articleIdx = Math.floor(brandIdx / brands.length)

    if (articleIdx < brandArticles.length) {
      const article = brandArticles[articleIdx]
      selected.push({
        id: article.id,
        title: article.title,
        content: article.content || '',
        brands: article.brands || [],
      })
    }

    brandIdx++

    // 防止無限迴圈：所有品牌都跑完一輪
    if (brandIdx >= brands.length * Math.ceil(count / brands.length) + brands.length) {
      break
    }
  }

  console.log(`✓ Selected ${selected.length} test articles from ${brandMap.size} brands`)
  for (const article of selected) {
    console.log(`   - [${article.brands[0] || '?'}] ${article.title.slice(0, 60)}`)
  }

  return selected.slice(0, count)
}
