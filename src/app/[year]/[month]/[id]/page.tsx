import { createServiceClient } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { WantCarLogo } from '@/components/WantCarLogo'
import { CommentForm } from '@/components/CommentForm'
import { CommentsList } from '@/components/CommentsList'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Metadata } from 'next'
import { StickyHeader } from '@/components/StickyHeader'
import { POPULAR_BRANDS, BRANDS_BY_COUNTRY } from '@/config/brands'
import { ArticleActionBar } from './ArticleActionBar'
import { HoverLink } from '@/components/HoverLink'
import { BrandTag } from './BrandTag'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { SanitizedContent } from '@/components/SanitizedContent'
import { ArticleImage } from '@/types/article'
import Script from 'next/script'

interface PageProps {
  params: Promise<{
    year: string
    month: string
    id: string
  }>
}

async function getArticle(id: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .single()

  if (error || !data) {
    return null
  }

  // View count is now handled by client-side API call
  // to avoid blocking server-side rendering
  return data
}

async function getComments(articleId: string) {
  const supabase = createServiceClient()

  // 1. 先查評論
  const { data: comments, error } = await supabase
    .from('comments')
    .select('id, content, created_at, user_id, likes_count')
    .eq('article_id', articleId)
    .eq('is_approved', true)
    .is('parent_id', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Page getComments] Error:', error)
    return []
  }

  if (!comments || comments.length === 0) {
    return []
  }

  // 2. 批量查詢所有用戶的 profiles
  const userIds = [...new Set(comments.map(c => c.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds)

  // 3. 手動組合資料
  const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const commentsWithProfiles = comments.map(comment => ({
    ...comment,
    profiles: profilesMap.get(comment.user_id) || null
  }))

  console.log('[Page getComments] Success:', {
    count: commentsWithProfiles.length,
    hasProfiles: commentsWithProfiles.every(c => c.profiles)
  })

  return commentsWithProfiles
}

async function getRelatedArticles(articleId: string, brands: string[], categories: string[]) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, published_at, cover_image, view_count, brands, categories')
    .eq('published', true)
    .neq('id', articleId)
    .limit(4)

  if (error) {
    console.error('Failed to fetch related articles:', error)
    return []
  }

  return data || []
}

/**
 * Generate SEO metadata for the article page
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year, month, id } = await params
  const article = await getArticle(id)

  if (!article) {
    return {
      title: '文章不存在 | 玩咖 WANT CAR',
      description: '抱歉，您所尋找的文章不存在或已被移除。'
    }
  }

  // 生成文章摘要（前150字）
  const description = article.content_zh
    ? article.content_zh.slice(0, 150).trim() + '...'
    : article.title_zh

  // 網站基礎 URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const articleUrl = `${baseUrl}/${year}/${month}/${id}`

  // 品牌和分類標籤
  const keywords = [
    '汽車新聞',
    'WANT CAR',
    '玩咖',
    '玩車資訊',
    ...(article.brands || []),
    ...(article.categories || [])
  ].join(', ')

  return {
    title: `${article.title_zh} | 玩咖 WANT CAR`,
    description,
    keywords,
    authors: [{ name: '玩咖 WANT CAR 編輯團隊' }],

    // Open Graph (Facebook, LinkedIn)
    openGraph: {
      type: 'article',
      url: articleUrl,
      title: article.title_zh,
      description,
      siteName: '玩咖 WANT CAR',
      locale: 'zh_TW',
      images: article.cover_image ? [
        {
          url: article.cover_image,
          width: 1792,
          height: 1024,
          alt: article.title_zh,
          type: 'image/webp'
        }
      ] : [],
      publishedTime: article.published_at,
      modifiedTime: article.updated_at,
      tags: [...(article.brands || []), ...(article.categories || [])]
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: article.title_zh,
      description,
      images: article.cover_image ? [article.cover_image] : [],
      creator: '@wantcar_tw'
    },

    // Additional metadata
    alternates: {
      canonical: articleUrl
    },

    // Robots
    robots: {
      index: article.published,
      follow: article.published,
      googleBot: {
        index: article.published,
        follow: article.published,
        'max-image-preview': 'large',
        'max-snippet': -1
      }
    }
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    notFound()
  }

  const comments = await getComments(id)
  const relatedArticles = await getRelatedArticles(id, article.brands || [], article.categories || [])

  // Generate JSON-LD structured data for SEO
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const publishedDate = new Date(article.published_at || article.created_at)
  const year = publishedDate.getFullYear()
  const month = String(publishedDate.getMonth() + 1).padStart(2, '0')
  const articleUrl = `${baseUrl}/${year}/${month}/${id}`

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title_zh,
    description: article.content_zh.slice(0, 150).trim() + '...',
    image: article.cover_image ? [article.cover_image] : [],
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at || article.published_at || article.created_at,
    author: {
      '@type': 'Organization',
      name: '玩咖 WANT CAR',
      url: baseUrl
    },
    publisher: {
      '@type': 'Organization',
      name: '玩咖 WANT CAR',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl
    },
    articleSection: article.categories?.[0] || 'news',
    keywords: [...(article.brands || []), ...(article.categories || []), ...(article.tags || [])].join(', ')
  }

  // 將 Markdown 轉換為 HTML（保留文章結構）
  const formatContent = (content: string) => {
    // 移除文章末尾的「資訊來源」或「資料來源」區塊
    // 這些內容已經通過 source_urls 欄位單獨顯示
    let cleanedContent = content

    // 找到「資訊來源」或「資料來源」開始的位置，並移除之後的所有內容
    const sourcePatterns = [
      /資訊來源[\s\S]*$/m,
      /資料來源[\s\S]*$/m,
      /本文綜合多方報導[\s\S]*$/m
    ]

    for (const pattern of sourcePatterns) {
      cleanedContent = cleanedContent.replace(pattern, '')
    }

    return cleanedContent
      .trim()
      // 移除 Markdown 分隔線
      .replace(/^---+$/gm, '')
      .replace(/^\*\*\*+$/gm, '')
      .replace(/^___+$/gm, '')
      // 標題轉換（必須在粗體之前處理）
      .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-6">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-6">$1</h1>')
      // 粗體（必須在斜體之前處理）
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      // 斜體
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
      // 行內代碼
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      // 移除孤立的星號（如果還有殘餘）
      .replace(/^\*\*\s*$/gm, '')
      // 段落分隔（兩個換行符表示新段落）
      .split('\n\n')
      .map(para => {
        const trimmed = para.trim()
        // 過濾掉空段落和只包含 HTML 標籤的段落
        if (!trimmed || trimmed === '<br>' || /^<\/?[^>]+>$/.test(trimmed)) {
          return ''
        }
        // 如果已經是 HTML 標籤開頭（h1, h2, h3），直接返回
        if (trimmed.startsWith('<h1') || trimmed.startsWith('<h2') || trimmed.startsWith('<h3')) {
          return trimmed
        }
        return `<p class="mb-6">${trimmed}</p>`
      })
      .filter(para => para) // 移除空字串
      .join('')
  }

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <Script
        id="article-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Client-side view tracking */}
        <ArticleViewTracker articleId={id} />

      {/* Sticky Header */}
      <StickyHeader popularBrands={POPULAR_BRANDS} brandsByCountry={BRANDS_BY_COUNTRY} showBrands={false} />

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Article Content */}
          <article className="px-0">
            {/* 1. Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {article.title_zh}
            </h1>

            {/* 2. Metadata: Time & Views */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
              {article.published_at && (
                <time className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(new Date(article.published_at), 'yyyy年MM月dd日', { locale: zhTW })}
                </time>
              )}
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {article.view_count} 閱讀
              </span>
            </div>

            {/* 2. Tags */}
            {(article.brands?.length > 0 || article.categories?.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {article.brands?.map((brand: string) => (
                  <BrandTag key={brand} brand={brand} />
                ))}
                {article.categories?.map((category: string) => (
                  <Link
                    key={category}
                    href={`/category/${category}`}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 transition-colors"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            )}

            {/* 3. Author */}
            <div className="text-sm text-gray-600 mb-6 pb-6 border-b border-gray-200">
              文：玩咖 AI 整理
            </div>

            {/* 4. Cover Image */}
            {article.cover_image && (
              <div className="mb-6">
                <div className="relative w-full aspect-[16/9] bg-gray-200">
                  <Image
                    src={article.cover_image}
                    alt={article.title_zh}
                    fill
                    className="object-cover"
                    priority
                    unoptimized
                  />
                </div>
                {article.image_credit && (
                  <div className="pt-2 pb-4 border-b border-gray-200">
                    <p className="text-xs text-gray-500">
                      圖片來源：<span className="font-medium">{article.image_credit}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 5. Article Content - Sanitized to prevent XSS */}
            <SanitizedContent
              html={formatContent(article.content_zh)}
              className="text-gray-700 leading-relaxed text-base"
            />

            {/* Additional Images Gallery */}
            {article.images && article.images.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">相關圖片</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {article.images.map((img: ArticleImage, index: number) => (
                    <div key={index} className="group">
                      <div className="relative aspect-[16/9] bg-gray-200 rounded-lg overflow-hidden">
                        <Image
                          src={img.url}
                          alt={img.caption || `圖片 ${index + 1}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        {img.caption && (
                          <p className="text-sm text-gray-700 line-clamp-2">{img.caption}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          圖片來源：<span className="font-medium">{img.credit}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source URLs */}
            {article.source_urls && article.source_urls.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">資料來源</h3>
                <ul className="space-y-2">
                  {article.source_urls.map((url: string, index: number) => (
                    <li key={index}>
                      <HoverLink
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline break-all"
                        baseColor="var(--brand-primary)"
                        hoverColor="var(--brand-primary-dark)"
                      >
                        {url}
                      </HoverLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Bar */}
            <ArticleActionBar
              articleId={id}
              title={article.title_zh}
              viewCount={article.view_count}
              commentCount={comments.length}
              initialLikeCount={article.likes_count || 0}
            />

            {/* Comments Section */}
            <div className="mt-12 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">評論 ({comments.length})</h2>

              {/* Comment Form */}
              <CommentForm articleId={id} />

              {/* Comments List with Sorting */}
              <CommentsList initialComments={comments} />
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">相關推薦</h3>
                <div className="space-y-4">
                  {relatedArticles.map((related: {
                    id: string
                    title_zh: string
                    published_at: string
                    cover_image?: string
                    view_count: number
                  }) => {
                    const year = related.published_at?.slice(0, 4) || new Date().getFullYear()
                    const month = related.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

                    // 生成漸層背景（與首頁卡片相同）
                    const gradients = [
                      'from-slate-800 to-slate-900',
                      'from-blue-900 to-slate-900',
                      'from-cyan-900 to-blue-900',
                      'from-indigo-900 to-slate-900',
                      'from-slate-700 to-blue-900',
                      'from-blue-800 to-cyan-900',
                    ]
                    const gradient = gradients[Math.abs(related.id.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0)) % gradients.length]

                    return (
                      <Link
                        key={related.id}
                        href={`/${year}/${month}/${related.id}`}
                        className="flex gap-3 group"
                      >
                        {/* 縮圖 */}
                        <div className={`relative w-28 h-20 flex-shrink-0 rounded overflow-hidden bg-gradient-to-br ${gradient}`}>
                          {related.cover_image ? (
                            <Image
                              src={related.cover_image}
                              alt={related.title_zh}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-10 h-10 opacity-30" style={{ color: 'var(--brand-primary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* 文字內容 */}
                        <div className="flex-1 min-w-0">
                          <h4
                            className="text-sm font-medium transition-colors line-clamp-2 mb-2 leading-snug block group-hover:text-[var(--brand-primary)]"
                            style={{ color: '#111827' }}
                          >
                            {related.title_zh}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {related.published_at && (
                              <time>
                                {format(new Date(related.published_at), 'MM/dd', { locale: zhTW })}
                              </time>
                            )}
                            <span>{related.view_count} 次播放</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Ad Space */}
            <div className="bg-gray-100 rounded-lg p-6 text-center border-2 border-dashed border-gray-300">
              <p className="text-sm text-gray-500 mb-2">廣告位置 AD-6</p>
              <p className="text-xs text-gray-400">160 x 600</p>
              <p className="text-xs text-gray-400 mt-1">摩天大樓廣告</p>
            </div>
          </aside>
        </div>
      </main>

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
    </>
  )
}
