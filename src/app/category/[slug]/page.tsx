import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { notFound } from 'next/navigation'

export const revalidate = 60

// 定义合法的分类
const VALID_CATEGORIES = ['新車', '評測', '行業', '數據', '技術']

const CATEGORY_INFO: Record<string, { title: string; description: string; icon: string }> = {
  '新車': {
    title: '新車發布',
    description: '最新車型發布、上市資訊',
    icon: '🚗'
  },
  '評測': {
    title: '專業評測',
    description: '深度試駕、性能測試',
    icon: '📊'
  },
  '行業': {
    title: '行業動態',
    description: '車企新聞、市場分析',
    icon: '🏢'
  },
  '數據': {
    title: '數據報告',
    description: '銷量數據、市場洞察',
    icon: '📈'
  },
  '技術': {
    title: '技術解析',
    description: '前沿技術、創新科技',
    icon: '⚙️'
  }
}

async function getArticlesByCategory(category: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, view_count, share_count, created_at, brands, car_models, categories, tags')
    .eq('published', true)
    .contains('categories', [category])
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }

  return data || []
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = decodeURIComponent(slug)

  // 验证分类是否合法
  if (!VALID_CATEGORIES.includes(category)) {
    notFound()
  }

  const articles = await getArticlesByCategory(category)
  const categoryInfo = CATEGORY_INFO[category]

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header - 复用主页Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-cyan-500/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">車勢日報</h1>
                <p className="text-[9px] sm:text-[10px] text-cyan-400 font-medium tracking-wider">AUTOPULSE</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm">
              <Link href="/" className="text-gray-300 hover:text-cyan-400 transition-colors font-medium whitespace-nowrap">首頁</Link>
              <Link href="/category/新車" className={`transition-colors font-medium whitespace-nowrap ${category === '新車' ? 'text-cyan-400' : 'text-gray-300 hover:text-cyan-400'}`}>新車</Link>
              <Link href="/category/評測" className={`transition-colors font-medium whitespace-nowrap ${category === '評測' ? 'text-cyan-400' : 'text-gray-300 hover:text-cyan-400'}`}>評測</Link>
              <Link href="/category/行業" className={`transition-colors font-medium whitespace-nowrap ${category === '行業' ? 'text-cyan-400' : 'text-gray-300 hover:text-cyan-400'}`}>行業</Link>
              <Link href="/category/數據" className={`transition-colors font-medium whitespace-nowrap ${category === '數據' ? 'text-cyan-400' : 'text-gray-300 hover:text-cyan-400'}`}>數據</Link>
            </nav>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="text-[10px] sm:text-xs text-gray-400 font-light tracking-wide">
              從數據到動力，AI 帶你看懂車界未來
            </p>
          </div>
        </div>
      </header>

      {/* Category Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{categoryInfo.icon}</span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">{categoryInfo.title}</h2>
              <p className="text-cyan-100 text-sm">{categoryInfo.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-6 w-full">
        {articles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">{categoryInfo.icon}</div>
            <p className="text-gray-500 text-lg mb-2">
              此分類暫無文章
            </p>
            <p className="text-gray-400 text-sm mb-6">
              系統會持續抓取並生成相關內容
            </p>
            <Link href="/" className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg transition-colors">
              返回首頁
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600 text-sm">
                找到 <span className="font-bold text-cyan-600">{articles.length}</span> 篇文章
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
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
        <div className={`relative aspect-[16/9] bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
          <svg className="w-20 h-20 text-cyan-400 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <div className="absolute top-3 left-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
            AI
          </div>
        </div>

        <div className="p-4">
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
