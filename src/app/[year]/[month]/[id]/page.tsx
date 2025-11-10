import { createClient, createServiceClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import ShareButtons from './ShareButtons'
import CommentSection from './CommentSection'

export const revalidate = 300 // 5分钟重新验证

type Props = {
  params: Promise<{
    year: string
    month: string
    id: string
  }>
}

async function getArticle(id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .single()

  if (error || !data) {
    return null
  }

  // 增加浏览量
  const serviceSupabase = createServiceClient()
  await serviceSupabase
    .from('generated_articles')
    .update({ view_count: data.view_count + 1 })
    .eq('id', id)

  return data
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    return {
      title: '文章未找到'
    }
  }

  return {
    title: `${article.title_zh} | Car News AI`,
    description: article.content_zh.slice(0, 160),
  }
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            ← 返回首頁
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {article.title_zh}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-200">
            <span>
              {article.published_at
                ? format(new Date(article.published_at), 'yyyy年MM月dd日', { locale: zhTW })
                : '最近發布'
              }
            </span>
            <span>👁 {article.view_count} 次瀏覽</span>
            <span>🔗 {article.share_count} 次分享</span>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none mb-8">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
              {article.content_zh}
            </ReactMarkdown>
          </div>

          {/* Sources */}
          {article.source_urls && article.source_urls.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                資訊來源
              </h3>
              <ul className="space-y-2">
                {article.source_urls.map((url: string, i: number) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Share Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <ShareButtons articleId={article.id} title={article.title_zh} />
          </div>
        </div>

        {/* Comments */}
        <div className="mt-8">
          <CommentSection articleId={article.id} />
        </div>
      </article>
    </div>
  )
}
