'use client'

import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useRef, useState, useEffect } from 'react'

interface Article {
  id: string
  title_zh: string
  published_at: string | null
  cover_image: string | null
  categories: string[] | null
  brands: string[] | null
}

interface TodayArticlesCarouselProps {
  articles: Article[]
}

export function TodayArticlesCarousel({ articles }: TodayArticlesCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
    }

    checkScroll()
    container.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)

    return () => {
      container.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [articles])

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 600, behavior: 'smooth' })
    }
  }

  if (articles.length === 0) return null

  return (
    <div className="bg-(--background)">
      <div className="max-w-[1440px] mx-auto px-12 py-8">
        {/* Header */}
        <div className="!hidden flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#404040', fontFamily: 'Merriweather, Noto Sans TC, serif' }}>
            今日最新
          </h2>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {articles.map((article) => {
              const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
              const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

              return (
              <Link
                key={article.id}
                href={`/${year}/${month}/${article.id}`}
                className="flex-shrink-0 group"
                style={{ scrollSnapAlign: 'start', width: '280px' }}
              >
                <article className="cursor-pointer bg-white overflow-hidden transition-opacity duration-200 group-hover:opacity-70">
                  {/* Image */}
                  <div className="relative overflow-hidden bg-gray-100" style={{ height: '180px' }}>
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

                  {/* Content */}
                  <div className="p-4">
                    {article.categories && article.categories.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs font-normal" style={{ color: '#FFBB00', lineHeight: '1.33' }}>
                          {article.categories[0]}
                        </span>
                      </div>
                    )}

                    <h3
                      className="line-clamp-2 leading-snug mb-2"
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        fontFamily: 'Merriweather, Noto Sans TC, serif',
                        color: '#404040',
                        lineHeight: '1.5'
                      }}
                    >
                      {article.title_zh}
                    </h3>

                    <div className="flex items-center gap-2 text-xs" style={{ color: '#808080' }}>
                      <span>
                        {article.published_at
                          ? format(new Date(article.published_at), 'MM.dd HH:mm', { locale: zhTW })
                          : '最近'}
                      </span>
                      {article.brands && article.brands.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="line-clamp-1">{article.brands.slice(0, 1).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
              )
            })}
          </div>

          {/* Scroll Right Button */}
          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all"
              style={{ color: '#404040' }}
              aria-label="查看更多今日文章"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
