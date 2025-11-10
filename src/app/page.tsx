import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export const revalidate = 60 // 每60秒重新验证

async function getPublishedArticles() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, published_at, view_count, share_count, created_at')
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

export default async function Home() {
  const articles = await getPublishedArticles()

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚗</span>
              <h1 className="text-2xl font-bold text-gray-900">Car News AI</h1>
            </div>
            <nav className="flex items-center gap-6 text-sm text-gray-600">
              <a href="#" className="hover:text-orange-500 transition-colors">首頁</a>
              <a href="#" className="hover:text-orange-500 transition-colors">新車</a>
              <a href="#" className="hover:text-orange-500 transition-colors">評測</a>
              <a href="#" className="hover:text-orange-500 transition-colors">行業</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <main className="flex-1">
            {articles.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">📰</div>
                <p className="text-gray-500 text-lg mb-2">
                  目前還沒有文章
                </p>
                <p className="text-gray-400 text-sm">
                  系統將自動抓取並生成內容，請稍後再查看
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </main>

          {/* Right Sidebar */}
          <aside className="w-[300px] flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                熱門文章
              </h3>
              {articles.length > 0 ? (
                <div className="space-y-3">
                  {articles.slice(0, 8).map((article, index) => (
                    <Link
                      key={article.id}
                      href={`/${article.published_at?.slice(0, 4) || new Date().getFullYear()}/${article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')}/${article.id}`}
                      className="flex items-start gap-3 hover:bg-gray-50 p-2 rounded transition-colors"
                    >
                      <span className="text-orange-500 font-semibold text-sm flex-shrink-0 w-5">
                        {index + 1}
                      </span>
                      <p className="text-sm text-gray-700 line-clamp-2 leading-snug">
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

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <p className="text-center text-xs text-gray-500">
            © 2025 Car News AI · Powered by Claude & OpenAI · AI驅動的汽車新聞聚合平台
          </p>
        </div>
      </footer>
    </div>
  )
}

function ArticleCard({ article }: { article: any }) {
  const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
  const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

  // 生成随机渐变色作为假缩略图
  const gradients = [
    'from-blue-400 to-blue-600',
    'from-purple-400 to-purple-600',
    'from-orange-400 to-orange-600',
    'from-green-400 to-green-600',
    'from-red-400 to-red-600',
    'from-indigo-400 to-indigo-600',
  ]
  const gradient = gradients[Math.abs(article.id.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0)) % gradients.length]

  return (
    <Link href={`/${year}/${month}/${article.id}`}>
      <article className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group">
        {/* 假缩略图 */}
        <div className={`relative aspect-[16/9] bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <span className="text-white text-5xl opacity-20">🚗</span>
          {/* HOT标签 */}
          <div className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded">
            AI生成
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4">
          <h2 className="text-base font-semibold text-gray-900 line-clamp-2 leading-snug mb-3 group-hover:text-orange-500 transition-colors">
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
