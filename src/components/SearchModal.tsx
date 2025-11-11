'use client'

import { useState, useEffect } from 'react'
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
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Article[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden' // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Search articles
  useEffect(() => {
    const searchArticles = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.articles || [])
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchArticles, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [isOpen])

  if (!isOpen) return null

  // Extract excerpt
  const getExcerpt = (content?: string) => {
    if (!content) return ''
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ')
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white">
      {/* Search Header */}
      <div className="border-b" style={{ borderColor: '#cdcdcd' }}>
        <div className="max-w-[1440px] mx-auto px-12 py-6">
          <div className="flex items-center gap-4">
            {/* Search Icon */}
            <svg className="w-6 h-6 flex-shrink-0" style={{ color: '#404040' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            {/* Search Input */}
            <input
              type="text"
              placeholder="請輸入關鍵字"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="flex-1 text-xl outline-none"
              style={{ color: '#404040' }}
            />

            {/* Search Button */}
            <button
              onClick={() => {
                // Trigger search explicitly if needed
              }}
              className="px-6 py-2 rounded transition-colors"
              style={{
                backgroundColor: '#FFBB00',
                color: '#333'
              }}
            >
              搜尋
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              style={{ color: '#404040' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="max-w-[1440px] mx-auto px-12 py-12 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
        {isSearching ? (
          <div className="text-center py-12" style={{ color: '#808080' }}>
            搜尋中...
          </div>
        ) : searchQuery.trim().length < 2 ? (
          <div className="text-center py-12" style={{ color: '#808080' }}>
            請輸入至少 2 個字符開始搜尋
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#808080' }}>
            沒有找到匹配結果
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((article) => {
              const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
              const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

              return (
              <Link
                key={article.id}
                href={`/${year}/${month}/${article.id}`}
                onClick={onClose}
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

                  {/* Excerpt */}
                  {article.content_zh && (
                    <p className="text-sm mb-2 line-clamp-2" style={{ color: '#808080' }}>
                      {getExcerpt(article.content_zh)}
                    </p>
                  )}

                  {/* Date */}
                  <div className="text-xs" style={{ color: '#808080' }}>
                    {article.published_at
                      ? format(new Date(article.published_at), 'yyyy年M月d日', { locale: zhTW })
                      : '最近'}
                  </div>
                </article>
              </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
