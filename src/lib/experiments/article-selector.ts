/**
 * 測試文章選取器
 * 從 DB 選取多樣化文章作為實驗樣本
 * 使用確定性排序確保所有實驗使用相同文章
 */

import { createServiceClient } from '@/lib/supabase'
import { TestArticle } from './types'

/**
 * 從 DB 選取多樣化測試文章
 * 策略：用 id 排序確保結果一致，跨品牌 round-robin 確保多樣性
 */
export async function selectTestArticles(count: number = 10): Promise<TestArticle[]> {
  const supabase = createServiceClient()

  // 用 id 排序確保每次選取結果一致（不受新文章影響順序）
  const { data: rawArticles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, brands')
    .eq('published', true)
    .not('content_zh', 'is', null)
    .not('brands', 'is', null)
    .order('id', { ascending: true })
    .limit(200)

  if (error) {
    throw new Error(`Failed to fetch test articles: ${error.message}`)
  }

  const articles = (rawArticles || []).map(a => ({
    id: a.id as string,
    title: a.title_zh as string,
    content: a.content_zh as string,
    brands: a.brands as string[],
  }))

  if (articles.length === 0) {
    throw new Error('No published articles found for testing')
  }

  // 按品牌分組，品牌名排序確保一致
  const brandMap = new Map<string, typeof articles[0][]>()

  for (const article of articles) {
    const brand = article.brands?.[0] || 'unknown'
    if (!brandMap.has(brand)) {
      brandMap.set(brand, [])
    }
    brandMap.get(brand)!.push(article)
  }

  const selected: TestArticle[] = []
  const brands = Array.from(brandMap.keys()).sort() // 排序確保一致

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
