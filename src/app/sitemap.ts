/**
 * Dynamic Sitemap Generation
 * Auto-generates sitemap.xml for all published articles
 */

import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()

  // 1. Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0
    }
  ]

  // 2. Get all published articles
  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, published_at, updated_at')
    .eq('published', true)
    .order('published_at', { ascending: false })

  const articlePages: MetadataRoute.Sitemap = (articles || []).map((article) => ({
    url: `${BASE_URL}/article/${article.id}`,
    lastModified: new Date(article.updated_at || article.published_at),
    changeFrequency: 'daily',
    priority: 0.8
  }))

  // 3. Get all brands
  const { data: brandsData } = await supabase
    .from('generated_articles')
    .select('brands')
    .eq('published', true)

  const uniqueBrands = new Set<string>()
  brandsData?.forEach((article: any) => {
    article.brands?.forEach((brand: string) => uniqueBrands.add(brand))
  })

  const brandPages: MetadataRoute.Sitemap = Array.from(uniqueBrands).map((brand) => ({
    url: `${BASE_URL}/brand/${brand}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7
  }))

  // 4. Get all categories
  const { data: categoriesData } = await supabase
    .from('generated_articles')
    .select('categories')
    .eq('published', true)

  const uniqueCategories = new Set<string>()
  categoriesData?.forEach((article: any) => {
    article.categories?.forEach((category: string) => uniqueCategories.add(category))
  })

  const categoryPages: MetadataRoute.Sitemap = Array.from(uniqueCategories).map((category) => ({
    url: `${BASE_URL}/category/${category}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7
  }))

  return [
    ...staticPages,
    ...articlePages,
    ...brandPages,
    ...categoryPages
  ]
}
