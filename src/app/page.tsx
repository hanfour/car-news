import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export const revalidate = 60 // 每60秒重新验证

async function getPublishedArticles() {
  const supabase = createClient()

  const { data, error} = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, view_count, share_count, created_at, brands, car_models, categories, tags')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }

  return data || []
}

async function getFeaturedArticles() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, brands, categories')
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
  const articles = await getPublishedArticles()
  const featuredArticles = await getFeaturedArticles()

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-cyan-500/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">車勢日報</h1>
                <p className="text-[9px] sm:text-[10px] text-cyan-400 font-medium tracking-wider">AUTOPULSE</p>
              </div>
            </div>

            {/* Search + Navigation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <input
                  type="search"
                  placeholder="搜索文章..."
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Navigation - Desktop */}
              <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm">
                <a href="#" className="text-gray-300 hover:text-cyan-400 transition-colors font-medium whitespace-nowrap">首頁</a>
                <a href="#" className="text-gray-300 hover:text-cyan-400 transition-colors font-medium whitespace-nowrap">新車</a>
                <a href="#" className="text-gray-300 hover:text-cyan-400 transition-colors font-medium whitespace-nowrap">評測</a>
                <a href="#" className="text-gray-300 hover:text-cyan-400 transition-colors font-medium whitespace-nowrap">行業</a>
                <a href="#" className="text-gray-300 hover:text-cyan-400 transition-colors font-medium whitespace-nowrap">數據</a>
              </nav>

              {/* Mobile Menu Button */}
              <button className="md:hidden flex items-center gap-2 text-gray-300 hover:text-cyan-400 transition-colors px-4 py-2 bg-slate-700/30 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="text-sm font-medium">選單</span>
              </button>
            </div>
          </div>

          {/* Slogan */}
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="text-[10px] sm:text-xs text-gray-400 font-light tracking-wide">
              從數據到動力，AI 帶你看懂車界未來
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full">
        {/* 今日要闻 Featured Articles */}
        {featuredArticles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-900">今日要聞</h2>
              <svg className="w-5 h-5 text-orange-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {featuredArticles.map((article: any) => (
                <Link
                  key={article.id}
                  href={`/${article.published_at?.slice(0, 4) || new Date().getFullYear()}/${article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')}/${article.id}`}
                  className="group bg-gradient-to-br from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 border-2 border-cyan-200 rounded-lg p-4 transition-all duration-200 hover:shadow-lg hover:scale-105"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-cyan-600 bg-cyan-100 px-2 py-1 rounded">
                      {article.categories?.[0] || '要聞'}
                    </span>
                    <svg className="w-4 h-4 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-cyan-700 transition-colors">
                    {article.title_zh}
                  </h3>
                  {article.brands && article.brands.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {article.brands.slice(0, 2).map((brand: string) => (
                        <span key={brand} className="text-[10px] text-gray-600 bg-white px-1.5 py-0.5 rounded">
                          {brand}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {articles.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 sm:p-12 text-center">
                <div className="text-4xl sm:text-6xl mb-4">📰</div>
                <p className="text-gray-500 text-base sm:text-lg mb-2">
                  目前還沒有文章
                </p>
                <p className="text-gray-400 text-xs sm:text-sm">
                  系統將自動抓取並生成內容，請稍後再查看
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </main>

          {/* Right Sidebar */}
          <aside className="w-full lg:w-[300px] flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                <svg className="w-4 h-4 text-cyan-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3 className="text-base font-semibold text-gray-900">
                  熱門文章
                </h3>
              </div>
              {articles.length > 0 ? (
                <div className="space-y-3">
                  {articles.slice(0, 8).map((article, index) => (
                    <Link
                      key={article.id}
                      href={`/${article.published_at?.slice(0, 4) || new Date().getFullYear()}/${article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')}/${article.id}`}
                      className="flex items-start gap-3 hover:bg-cyan-50 p-2 rounded transition-colors group"
                    >
                      <span className="text-cyan-600 font-bold text-sm flex-shrink-0 w-5 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </span>
                      <p className="text-sm text-gray-700 line-clamp-2 leading-snug group-hover:text-cyan-700">
                        {article.title_zh}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  暫無熱門文章
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Footer - Sticky to bottom */}
      <footer className="mt-auto bg-gradient-to-r from-slate-900 to-slate-800 border-t border-cyan-500/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-sm">
            <div className="text-center sm:text-left">
              <p className="text-white font-semibold mb-1">車勢日報 AutoPulse</p>
              <p className="text-gray-400 text-xs">從數據到動力，AI 帶你看懂車界未來</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-gray-400 text-xs">
                © 2025 AutoPulse · Powered by <span className="text-cyan-400">Claude</span> & <span className="text-cyan-400">OpenAI</span>
              </p>
              <p className="text-gray-500 text-[10px] mt-1">
                AI驅動的汽車新聞聚合平台
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ArticleCard({ article }: { article: any }) {
  const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
  const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

  // 生成随机渐变色作为假缩略图 - 专业科技配色
  const gradients = [
    'from-slate-800 to-slate-900',
    'from-blue-900 to-slate-900',
    'from-cyan-900 to-blue-900',
    'from-indigo-900 to-slate-900',
    'from-slate-700 to-blue-900',
    'from-blue-800 to-cyan-900',
  ]
  const gradient = gradients[Math.abs(article.id.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0)) % gradients.length]

  return (
    <Link href={`/${year}/${month}/${article.id}`}>
      <article className="bg-white rounded-lg overflow-hidden hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 cursor-pointer group border border-gray-200">
        {/* 假缩略图 */}
        <div className={`relative aspect-[16/9] bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          {/* 网格背景 */}
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>

          {/* 脉搏图标 */}
          <svg className="w-20 h-20 text-cyan-400 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>

          {/* AI标签 */}
          <div className="absolute top-3 left-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
            AI
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {/* 标签栏 */}
          {(article.categories || article.brands) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {article.categories?.slice(0, 1).map((cat: string) => (
                <span key={cat} className="text-[10px] font-semibold text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded">
                  {cat}
                </span>
              ))}
              {article.brands?.slice(0, 2).map((brand: string) => (
                <span key={brand} className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {brand}
                </span>
              ))}
            </div>
          )}

          <h2 className="text-base font-semibold text-gray-900 line-clamp-2 leading-snug mb-3 group-hover:text-cyan-600 transition-colors">
            {article.title_zh}
          </h2>

          {/* 元数据 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {article.published_at
                ? format(new Date(article.published_at), 'MM-dd HH:mm', { locale: zhTW })
                : '最近'
              }
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {article.view_count}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {article.share_count}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
