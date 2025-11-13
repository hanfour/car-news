'use client'

import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useState, useRef } from 'react'

interface Article {
  id: string
  title_zh: string
  published_at: string | null
  cover_image: string | null
  categories: string[] | null
  primary_brand: string | null
}

interface PopularArticlesCarouselProps {
  articles: Article[]
}

export function PopularArticlesCarousel({ articles }: PopularArticlesCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  if (articles.length === 0) return null

  // Group articles into pairs (2 per slide)
  const slides: Article[][] = []
  for (let i = 0; i < articles.length; i += 2) {
    slides.push(articles.slice(i, i + 2))
  }

  const totalSlides = slides.length
  const currentSlide = slides[currentIndex] || []

  // Navigation handlers
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalSlides - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === totalSlides - 1 ? 0 : prev + 1))
  }

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50 // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext() // Swipe left -> next
      } else {
        goToPrevious() // Swipe right -> previous
      }
    }
  }

  return (
    <div className="bg-(--background)">
      <div className="w-full px-4 sm:px-6 lg:px-12 py-12">
        {/* Section Title */}
        <h2 className="hidden text-2xl font-bold mb-8" style={{ color: '#404040', fontFamily: 'Merriweather, Noto Sans TC, serif' }}>
          熱門話題
        </h2>

        {/* Carousel Container */}
        <div className="relative">
          {/* Articles Grid - 2 columns on desktop, 1 on mobile */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {currentSlide.map((article) => {
              const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
              const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

              return (
              <Link
                key={article.id}
                href={`/${year}/${month}/${article.id}`}
                prefetch={false}
                className="group"
              >
                <article className="cursor-pointer transition-opacity duration-200 group-hover:opacity-70">
                  {/* Image */}
                  <div className="relative overflow-hidden bg-gray-100 mb-4" style={{ height: '300px' }}>
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
                        <svg className="w-20 h-20 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Category Tag */}
                  {article.categories && article.categories.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm font-medium" style={{ color: '#FFBB00' }}>
                        {article.categories[0]}
                      </span>
                    </div>
                  )}

                  {/* Title */}
                  <h3
                    className="mb-3"
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      fontFamily: 'Merriweather, Noto Sans TC, serif',
                      color: '#404040',
                      lineHeight: '1.4'
                    }}
                  >
                    {article.title_zh}
                  </h3>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#808080' }}>
                    <span>
                      {article.published_at
                        ? format(new Date(article.published_at), 'yyyy.MM.dd', { locale: zhTW })
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

          {/* Dots Navigation */}
          {totalSlides > 1 && (
            <div className="flex justify-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className="w-2 h-2 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: index === currentIndex ? '#FFBB00' : '#cdcdcd'
                  }}
                  aria-label={`跳到第 ${index + 1} 組文章`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
