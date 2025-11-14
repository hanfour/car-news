import { createClient } from '@/lib/supabase'
import { StickyHeader } from '@/components/StickyHeader'
import { TodayArticlesCarousel } from '@/components/TodayArticlesCarousel'
import { TodayFeaturedSection } from '@/components/TodayFeaturedSection'
import { PopularArticlesCarousel } from '@/components/PopularArticlesCarousel'
import { AllArticlesGrid } from '@/components/AllArticlesGrid'
import { TagCloud } from '@/components/TagCloud'
import { POPULAR_BRANDS, BRANDS_BY_COUNTRY } from '@/config/brands'
import type { Article, ArticleWithContent, ArticleWithBrands, Tag } from '@/types/article'
import { Metadata } from 'next'

export const revalidate = 60 // 每60秒重新验证

/**
 * Homepage SEO metadata
 */
export const metadata: Metadata = {
  title: '玩咖 WANT CAR - 想要車？玩車資訊一網打盡',
  description: '玩咖 WANT CAR 使用 AI 技術聚合全球汽車新聞，為您提供 Tesla、BMW、Mercedes、Toyota 等熱門品牌的最新資訊、新車發表、評測報導和行業動態。',
  keywords: '汽車新聞, 電動車, Tesla, BMW, 新車, 汽車評測, WANT CAR, 玩咖, 玩車資訊',
  authors: [{ name: '玩咖 WANT CAR 編輯團隊' }],

  openGraph: {
    type: 'website',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.com',
    title: '玩咖 WANT CAR - 想要車？玩車資訊一網打盡',
    description: '從數據到動力，AI 帶你玩懂車界未來。聚合全球汽車新聞，提供 Tesla、BMW、Mercedes 等品牌最新資訊。',
    siteName: '玩咖 WANT CAR',
    locale: 'zh_TW'
  },

  twitter: {
    card: 'summary_large_image',
    title: '玩咖 WANT CAR - 想要車？玩車資訊一網打盡',
    description: '從數據到動力，AI 帶你玩懂車界未來',
    creator: '@wantcar_tw'
  },

  alternates: {
    canonical: process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.com'
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  }
}

/**
 * Date utility functions
 */
function getStartOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function getDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

// Common field selection to avoid duplication - includes all required Article fields
const ARTICLE_LIST_FIELDS = 'id, title_zh, published_at, cover_image, categories, primary_brand, car_models'
const ARTICLE_WITH_STATS = `${ARTICLE_LIST_FIELDS}, view_count, share_count`

async function getPublishedArticles(): Promise<Article[]> {
  const supabase = createClient()

  const { data, error} = await supabase
    .from('generated_articles')
    .select(ARTICLE_WITH_STATS)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }

  return data || []
}

async function getAllTags(): Promise<Tag[]> {
  const supabase = createClient()

  // 使用數據庫函數進行高效聚合
  // 注意: 需要先在 Supabase 中執行 supabase/migrations/20250111_get_popular_tags_function.sql
  const { data, error } = await supabase
    .rpc('get_popular_tags', { tag_limit: 30 })

  if (error) {
    console.error('Failed to fetch tags:', error)
    // Fallback to old method if RPC function doesn't exist yet
    return await getAllTagsFallback()
  }

  return data || []
}

// Fallback method for backwards compatibility
async function getAllTagsFallback(): Promise<Tag[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('tags')
    .eq('published', true)
    .not('tags', 'is', null)

  if (error) {
    console.error('Failed to fetch tags (fallback):', error)
    return []
  }

  const tagCounts: Record<string, number> = {}
  data.forEach((article) => {
    if (article.tags && Array.isArray(article.tags)) {
      article.tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })

  return Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
}

async function getTodayArticles(): Promise<ArticleWithBrands[]> {
  const supabase = createClient()
  const today = getStartOfToday()

  const { data, error } = await supabase
    .from('generated_articles')
    .select(`${ARTICLE_WITH_STATS}, brands`)
    .eq('published', true)
    .gte('published_at', today.toISOString())
    .order('view_count', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(12)

  if (error) {
    console.error('Failed to fetch today articles:', error)
    return []
  }

  return data || []
}

async function getWeeklyTopArticles(): Promise<ArticleWithContent[]> {
  const supabase = createClient()
  const weekAgo = getDaysAgo(7)

  const { data, error } = await supabase
    .from('generated_articles')
    .select(`${ARTICLE_WITH_STATS}, content_zh`)
    .eq('published', true)
    .gte('published_at', weekAgo.toISOString())
    .order('view_count', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(6)

  if (error) {
    console.error('Failed to fetch weekly top articles:', error)
    return []
  }

  return data || []
}

async function getRecentPopularArticles(): Promise<Article[]> {
  const supabase = createClient()
  const threeDaysAgo = getDaysAgo(3)

  const { data, error } = await supabase
    .from('generated_articles')
    .select(ARTICLE_WITH_STATS)
    .eq('published', true)
    .gte('published_at', threeDaysAgo.toISOString())
    .order('view_count', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(6)

  if (error) {
    console.error('Failed to fetch recent popular articles:', error)
    return []
  }

  return data || []
}

async function getFeaturedArticles(): Promise<ArticleWithBrands[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, brands, categories, cover_image, view_count, share_count, primary_brand, car_models')
    .eq('published', true)
    .eq('is_featured', true)
    .order('published_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Failed to fetch featured articles:', error)
    return []
  }

  return data || []
}

export default async function Home() {
  // 並行執行所有數據查詢以提升性能
  const [articles, todayArticles, weeklyTopArticles, recentPopularArticles, allTags] = await Promise.all([
    getPublishedArticles(),
    getTodayArticles(),
    getWeeklyTopArticles(),
    getRecentPopularArticles(),
    getAllTags(),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header with Sidebar */}
      <StickyHeader popularBrands={POPULAR_BRANDS} brandsByCountry={BRANDS_BY_COUNTRY} />

      {/* 今日最新文章輪播 */}
      <TodayArticlesCarousel articles={todayArticles} />

      <div className="w-full flex flex-col justify-center items-center">
          {/* 本週焦點區塊 - 最大區塊+小列表 */}
          <TodayFeaturedSection articles={weeklyTopArticles} />

          {/* 熱門話題輪播 - 過去三天熱門文章 */}
          <PopularArticlesCarousel articles={recentPopularArticles} />

          {/* 所有文章網格 - 9則+篩選+更多按鈕 */}
          <AllArticlesGrid articles={articles} />

          {/* 玩咖熱詞標籤雲 */}
          <TagCloud tags={allTags} />
      </div>

      {/* Footer */}
      <footer className="bg-[#333]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-white font-semibold mb-1">玩咖 WANT CAR</p>
              <p className="text-gray-400 text-sm">想要車？從數據到動力，AI 帶你玩懂車界未來</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">
                © 2025 WANT CAR · Powered by <span style={{ color: '#FFD966' }}>AI</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
