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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">🚗 Car News AI</h1>
          <p className="mt-2 text-sm text-gray-600">
            AI驅動的汽車新聞聚合平台
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              目前還沒有文章。系統將自動抓取並生成內容。
            </p>
            <p className="text-gray-400 text-sm mt-2">
              請稍後再查看，或檢查Cron任務是否正常運行。
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            © 2025 Car News AI. Powered by Claude & OpenAI.
          </p>
        </div>
      </footer>
    </div>
  )
}

function ArticleCard({ article }: { article: any }) {
  const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
  const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

  // 提取摘要（前200字）
  const excerpt = article.content_zh
    .replace(/^#+\s+.+$/gm, '') // 移除标题
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接markdown
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体
    .slice(0, 200) + '...'

  return (
    <Link href={`/${year}/${month}/${article.id}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 h-full cursor-pointer">
        <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
          {article.title_zh}
        </h2>

        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {excerpt}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {article.published_at
              ? format(new Date(article.published_at), 'yyyy年MM月dd日', { locale: zhTW })
              : '最近發布'
            }
          </span>
          <div className="flex gap-3">
            <span>👁 {article.view_count}</span>
            <span>🔗 {article.share_count}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
