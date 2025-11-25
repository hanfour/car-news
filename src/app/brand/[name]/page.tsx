import { createClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { StickyHeader } from '@/components/StickyHeader'
import { POPULAR_BRANDS, BRANDS_BY_COUNTRY } from '@/config/brands'
import { ArticleCard } from '@/components/ArticleCard'
import { ArticleListSidebar } from '@/components/ArticleListSidebar'

export const revalidate = 60

async function getArticlesByBrand(brand: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, source_published_at, view_count, share_count, created_at, brands, car_models, categories, tags, cover_image')
    .eq('published', true)
    .eq('primary_brand', brand)  // 只顯示主要品牌匹配的文章
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }

  return data || []
}

export default async function BrandPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const brand = decodeURIComponent(name)

  const articles = await getArticlesByBrand(brand)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <StickyHeader popularBrands={POPULAR_BRANDS} brandsByCountry={BRANDS_BY_COUNTRY} showBrands={false} currentPath={`/brand/${brand}`} />

      {/* Main Content */}
      <div className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Articles List */}
          <div>
            {articles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-2">此品牌暫無文章</p>
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
      <footer className="bg-[var(--foreground)]">
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
