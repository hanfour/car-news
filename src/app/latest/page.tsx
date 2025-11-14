import { createClient } from '@/lib/supabase'
import { StickyHeader } from '@/components/StickyHeader'
import { POPULAR_BRANDS, BRANDS_BY_COUNTRY } from '@/config/brands'
import { ArticleCard } from '@/components/ArticleCard'
import { ArticleListSidebar } from '@/components/ArticleListSidebar'

export const revalidate = 60

export const metadata = {
  title: '最新文章 | 玩咖 WANT CAR',
  description: '瀏覽所有最新汽車新聞、評測報導和產業動態，按時間排序顯示。',
}

async function getLatestArticles() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, view_count, share_count, categories, brands, cover_image')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to fetch latest articles:', error)
    return []
  }

  return data || []
}

export default async function LatestPage() {
  const articles = await getLatestArticles()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky Header */}
      <StickyHeader popularBrands={POPULAR_BRANDS} brandsByCountry={BRANDS_BY_COUNTRY} showBrands={false} currentPath="/latest" />

      {/* Main Content */}
      <div className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Articles List */}
          <div>
            {articles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-2">目前沒有文章</p>
                <p className="text-gray-400 text-sm mb-6">
                  系統會持續抓取並生成相關內容
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {articles.map((article) => {
                  const gradients = [
                    'from-slate-800 to-slate-900',
                    'from-blue-900 to-slate-900',
                    'from-cyan-900 to-blue-900',
                    'from-indigo-900 to-slate-900',
                    'from-slate-700 to-blue-900',
                    'from-blue-800 to-cyan-900',
                  ]
                  const gradient = gradients[Math.abs(article.id.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0)) % gradients.length]

                  return <ArticleCard key={article.id} article={article} gradient={gradient} />
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <ArticleListSidebar />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[var(--foreground)] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-white font-semibold mb-1">玩咖 WANT CAR</p>
              <p className="text-gray-400 text-sm">想要車？從數據到動力，AI 帶你玩懂車界未來</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">
                © 2025 WANT CAR · Powered by <span className="text-[var(--brand-primary)]">AI</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
