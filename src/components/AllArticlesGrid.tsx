'use client'

import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useState } from 'react'

interface Article {
  id: string
  title_zh: string
  published_at: string | null
  cover_image: string | null
  categories: string[] | null
  primary_brand: string | null
  view_count: number | null
  share_count: number | null
}

interface AllArticlesGridProps {
  articles: Article[]
}

type SortOption = 'latest' | 'most_viewed' | 'most_shared'

export function AllArticlesGrid({ articles }: AllArticlesGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>('latest')
  const [showAll, setShowAll] = useState(false)

  // Sort articles based on selected option
  const sortedArticles = [...articles].sort((a, b) => {
    switch (sortBy) {
      case 'most_viewed':
        return (b.view_count || 0) - (a.view_count || 0)
      case 'most_shared':
        return (b.share_count || 0) - (a.share_count || 0)
      case 'latest':
      default:
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0
        return dateB - dateA
    }
  })

  const displayedArticles = showAll ? sortedArticles : sortedArticles.slice(0, 9)

  return (
    <div className="">
      <div className="max-w-[1440px] mx-auto px-12 py-12">
        {/* Section Header with Filter */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="hidden text-2xl font-bold" style={{ color: '#404040', fontFamily: 'Merriweather, Noto Sans TC, serif' }}>
            所有文章
          </h2>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy('latest')}
              className="px-4 py-2 text-sm font-medium transition-colors rounded cursor-pointer"
              style={{
                color: sortBy === 'latest' ? '#333' : '#808080',
                backgroundColor: sortBy === 'latest' ? '#FFBB00' : 'transparent',
                border: sortBy === 'latest' ? 'none' : '1px solid #cdcdcd'
              }}
            >
              最新
            </button>
            <button
              onClick={() => setSortBy('most_viewed')}
              className="px-4 py-2 text-sm font-medium transition-colors rounded cursor-pointer"
              style={{
                color: sortBy === 'most_viewed' ? '#333' : '#808080',
                backgroundColor: sortBy === 'most_viewed' ? '#FFBB00' : 'transparent',
                border: sortBy === 'most_viewed' ? 'none' : '1px solid #cdcdcd'
              }}
            >
              觀看最多
            </button>
            <button
              onClick={() => setSortBy('most_shared')}
              className="px-4 py-2 text-sm font-medium transition-colors rounded cursor-pointer"
              style={{
                color: sortBy === 'most_shared' ? '#333' : '#808080',
                backgroundColor: sortBy === 'most_shared' ? '#FFBB00' : 'transparent',
                border: sortBy === 'most_shared' ? 'none' : '1px solid #cdcdcd'
              }}
            >
              分享最多
            </button>
          </div>
        </div>

        {/* Articles Grid - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {displayedArticles.map((article) => {
            const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
            const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

            return (
            <Link
              key={article.id}
              href={`/${year}/${month}/${article.id}`}
              className="group"
            >
              <article className="cursor-pointer transition-opacity duration-200 group-hover:opacity-70">
                {/* Image */}
                <div className="relative overflow-hidden bg-gray-100 mb-3" style={{ height: '200px' }}>
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
                      <svg className="w-16 h-16 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Category Tag */}
                {article.categories && article.categories.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium" style={{ color: '#FFBB00' }}>
                      {article.categories[0]}
                    </span>
                  </div>
                )}

                {/* Title */}
                <h3
                  className="line-clamp-2 mb-2"
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    fontFamily: 'Merriweather, Noto Sans TC, serif',
                    color: '#404040',
                    lineHeight: '1.4'
                  }}
                >
                  {article.title_zh}
                </h3>

                {/* Metadata */}
                <div className="flex items-center gap-2 text-xs" style={{ color: '#808080' }}>
                  <span>
                    {article.published_at
                      ? format(new Date(article.published_at), 'MM.dd', { locale: zhTW })
                      : '最近'}
                  </span>
                  {article.primary_brand && (
                    <>
                      <span>·</span>
                      <span>{article.primary_brand}</span>
                    </>
                  )}
                </div>
              </article>
            </Link>
            )
          })}
        </div>

        {/* Load More Button */}
        {!showAll && sortedArticles.length > 9 && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAll(true)}
              className="px-8 py-3 text-sm font-medium transition-colors rounded"
              style={{
                color: '#333',
                backgroundColor: '#FFBB00',
                border: 'none'
              }}
            >
              更多文章
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
