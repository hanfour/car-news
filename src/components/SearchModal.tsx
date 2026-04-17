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

interface ForumPost {
  id: string
  title: string
  content: string
  created_at: string
  reply_count: number
  author?: { username?: string; display_name?: string; avatar_url?: string }
  category?: { name: string; slug: string; icon?: string }
}

type TabKey = 'all' | 'news' | 'forum'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [articleResults, setArticleResults] = useState<Article[]>([])
  const [forumResults, setForumResults] = useState<ForumPost[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('all')

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

  // Search articles + forum posts
  useEffect(() => {
    const searchAll = async () => {
      if (searchQuery.trim().length < 2) {
        setArticleResults([])
        setForumResults([])
        return
      }

      setIsSearching(true)
      try {
        const [articleRes, forumRes] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`),
          fetch(`/api/forum/posts?search=${encodeURIComponent(searchQuery)}&limit=20`),
        ])

        const articleData = await articleRes.json()
        setArticleResults(articleData.articles || [])

        const forumData = await forumRes.json()
        setForumResults(forumData.posts || [])
      } catch (error) {
        console.error('Search error:', error)
        setArticleResults([])
        setForumResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchAll, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setArticleResults([])
      setForumResults([])
      setActiveTab('all')
    }
  }, [isOpen])

  if (!isOpen) return null

  // Extract excerpt
  const getExcerpt = (content?: string, maxLen = 100) => {
    if (!content) return ''
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ')
    return plainText.length > maxLen ? plainText.substring(0, maxLen) + '...' : plainText
  }

  const hasResults = articleResults.length > 0 || forumResults.length > 0
  const filteredArticles = activeTab === 'forum' ? [] : articleResults
  const filteredForum = activeTab === 'news' ? [] : forumResults

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: articleResults.length + forumResults.length },
    { key: 'news', label: '新聞', count: articleResults.length },
    { key: 'forum', label: '討論', count: forumResults.length },
  ]

  return (
    <div
      className="fixed inset-0 z-[100] bg-white search-modal-height"
    >
      {/* Search Header */}
      <div className="border-b" style={{ borderColor: '#cdcdcd' }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-12 py-4 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Search Icon */}
            <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            {/* Search Input */}
            <input
              type="text"
              placeholder="請輸入關鍵字"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="flex-1 text-base sm:text-xl outline-none min-w-0 text-text-primary"
            />

            {/* Search Button - Hidden on mobile, visible on larger screens */}
            <button
              onClick={() => {
                // Trigger search explicitly if needed
              }}
              className="hidden sm:block px-6 py-2 rounded transition-colors flex-shrink-0"
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#333'
              }}
            >
              搜尋
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0 text-text-primary"
              aria-label="關閉搜尋"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {hasResults && (
        <div className="border-b" style={{ borderColor: '#e5e5e5' }}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-12 flex gap-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                    : 'border-transparent hover:border-gray-300'
                }`}
                style={{ color: activeTab === tab.key ? undefined : 'var(--text-secondary)' }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div
        className="max-w-[1440px] mx-auto px-4 sm:px-12 py-6 sm:py-12 overflow-y-auto search-results-height"
      >
        {isSearching ? (
          <div className="text-center py-12" style={{ color: '#808080' }}>
            搜尋中...
          </div>
        ) : searchQuery.trim().length < 2 ? (
          <div className="text-center py-12" style={{ color: '#808080' }}>
            請輸入至少 2 個字符開始搜尋
          </div>
        ) : !hasResults ? (
          <div className="text-center py-12" style={{ color: '#808080' }}>
            沒有找到匹配結果
          </div>
        ) : (
          <div className="space-y-8">
            {/* Article Results */}
            {filteredArticles.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>
                    新聞文章 ({articleResults.length})
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredArticles.map((article) => {
                    const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
                    const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

                    return (
                    <Link
                      key={article.id}
                      href={`/${year}/${month}/${article.id}`}
                      prefetch={false}
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
                            <span className="text-xs font-medium" style={{ color: '#FDB90B' }}>
                              {article.categories[0]}
                            </span>
                          </div>
                        )}

                        {/* Title */}
                        <h3
                          className="line-clamp-2 mb-2 text-text-primary font-heading"
                          style={{
                            fontSize: '18px',
                            fontWeight: 700,
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
              </div>
            )}

            {/* Forum Results */}
            {filteredForum.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>
                    討論區貼文 ({forumResults.length})
                  </h3>
                )}
                <div className="space-y-3">
                  {filteredForum.map((post) => (
                    <Link
                      key={post.id}
                      href={`/community/post/${post.id}`}
                      prefetch={false}
                      onClick={onClose}
                      className="block group"
                    >
                      <div className="p-4 rounded-lg border hover:border-[var(--brand-primary)] transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Category + Title */}
                            <div className="flex items-center gap-2 mb-1">
                              {post.category && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--brand-primary-lighter)', color: 'var(--brand-primary)' }}>
                                  {post.category.icon} {post.category.name}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-medium mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                              {post.title}
                            </h4>
                            <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--text-tertiary)' }}>
                              {getExcerpt(post.content, 150)}
                            </p>
                            {/* Meta */}
                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              <span>{post.author?.display_name || '匿名'}</span>
                              <span>{format(new Date(post.created_at), 'M月d日', { locale: zhTW })}</span>
                              <span>{post.reply_count ?? 0} 回覆</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
