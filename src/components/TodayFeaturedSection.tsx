'use client'

import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Article {
  id: string
  title_zh: string
  content_zh?: string
  published_at: string | null
  cover_image: string | null
  categories: string[] | null
  primary_brand: string | null
  car_models: string[] | null
  view_count: number | null
}

interface TodayFeaturedSectionProps {
  articles: Article[]
}

export function TodayFeaturedSection({ articles }: TodayFeaturedSectionProps) {
  if (articles.length === 0) return null

  const [featuredArticle, ...moreArticles] = articles

  // Extract excerpt from content (first 150 chars)
  const getExcerpt = (content?: string) => {
    if (!content) return ''
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ')
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText
  }

  const featuredYear = featuredArticle.published_at?.slice(0, 4) || new Date().getFullYear()
  const featuredMonth = featuredArticle.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

  return (
    <div className="bg-white w-full">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-12">
        {/* Section Title */}
        <h2 className="hidden text-2xl font-bold mb-8" style={{ color: '#404040', fontFamily: 'Merriweather, Noto Sans TC, serif' }}>
          今日焦點
        </h2>

        {/* Desktop: Side by Side | Mobile: Stacked */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Featured Article - Left Side (60%) */}
          <Link
            href={`/${featuredYear}/${featuredMonth}/${featuredArticle.id}`}
            className="flex-1 lg:w-[60%] group"
          >
            <article className="cursor-pointer transition-opacity duration-200 group-hover:opacity-70">
              {/* Large Image */}
              <div className="relative overflow-hidden bg-gray-100 mb-4" style={{ height: '400px' }}>
                {featuredArticle.cover_image ? (
                  <Image
                    src={featuredArticle.cover_image}
                    alt={featuredArticle.title_zh}
                    fill
                    className="object-cover"
                    priority
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <svg className="w-24 h-24 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Category Tag */}
              {featuredArticle.categories && featuredArticle.categories.length > 0 && (
                <div className="mb-3">
                  <span className="text-sm font-medium" style={{ color: '#FFBB00' }}>
                    {featuredArticle.categories[0]}
                  </span>
                </div>
              )}

              {/* Title */}
              <h3
                className="mb-3"
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  fontFamily: 'Merriweather, Noto Sans TC, serif',
                  color: '#404040',
                  lineHeight: '1.4'
                }}
              >
                {featuredArticle.title_zh}
              </h3>

              {/* Excerpt */}
              <p className="mb-3 leading-relaxed" style={{ fontSize: '16px', color: '#808080', lineHeight: '1.75' }}>
                {getExcerpt(featuredArticle.content_zh)}
              </p>

              {/* Metadata */}
              <div className="flex items-center gap-3 text-sm" style={{ color: '#808080' }}>
                <span>
                  {featuredArticle.published_at
                    ? format(new Date(featuredArticle.published_at), 'yyyy.MM.dd HH:mm', { locale: zhTW })
                    : '最近'}
                </span>
                {featuredArticle.primary_brand && (
                  <>
                    <span>·</span>
                    <span>{featuredArticle.primary_brand}</span>
                  </>
                )}
                {featuredArticle.view_count !== null && featuredArticle.view_count > 0 && (
                  <>
                    <span>·</span>
                    <span>{featuredArticle.view_count.toLocaleString()} 次觀看</span>
                  </>
                )}
              </div>
            </article>
          </Link>

          {/* More Articles - Right Side (40%) */}
          <div className="flex-1 lg:w-[40%]">
            <div className="space-y-6">
              {moreArticles.slice(0, 5).map((article) => {
                const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
                const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

                return (
                <Link
                  key={article.id}
                  href={`/${year}/${month}/${article.id}`}
                  className="flex gap-4 group"
                >
                  <article className="flex gap-4 cursor-pointer transition-opacity duration-200 group-hover:opacity-70 w-full">
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0 overflow-hidden bg-gray-100" style={{ width: '140px', height: '95px' }}>
                      {article.cover_image ? (
                        <Image
                          src={article.cover_image}
                          alt={article.title_zh}
                          fill
                          className="object-cover"
                          loading="lazy"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      {/* Category */}
                      {article.categories && article.categories.length > 0 && (
                        <div className="mb-1">
                          <span className="text-xs font-medium" style={{ color: '#FFBB00' }}>
                            {article.categories[0]}
                          </span>
                        </div>
                      )}

                      {/* Title */}
                      <h4
                        className="line-clamp-2 mb-2"
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          fontFamily: 'Merriweather, Noto Sans TC, serif',
                          color: '#404040',
                          lineHeight: '1.5'
                        }}
                      >
                        {article.title_zh}
                      </h4>

                      {/* Metadata */}
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#808080' }}>
                        <span>
                          {article.published_at
                            ? format(new Date(article.published_at), 'MM.dd HH:mm', { locale: zhTW })
                            : '最近'}
                        </span>
                        {article.primary_brand && (
                          <>
                            <span>·</span>
                            <span className="line-clamp-1">{article.primary_brand}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
