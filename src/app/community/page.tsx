'use client'

import { useState, useEffect } from 'react'
import { CommunityFeed } from '@/components/community/CommunityFeed'
import { CommunityComposeTrigger } from '@/components/community/CommunityComposeTrigger'
import { TrendingSidebar } from '@/components/community/TrendingSidebar'
import { CategoryPills } from '@/components/community/CategoryPills'

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  post_count: number
}

type SortOption = 'latest' | 'popular' | 'active'

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'latest', label: '最新' },
  { value: 'popular', label: '熱門' },
  { value: 'active', label: '活躍' },
]

export default function CommunityPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('latest')

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/forum/categories')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.categories)
        }
      } catch (err) {
        console.error('[CommunityPage] fetchCategories:', err)
      }
    }
    fetchCategories()
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          社群
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          與車友交流、分享你的想法
        </p>
      </div>

      <div className="flex gap-6">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Compose trigger */}
          <CommunityComposeTrigger />

          {/* Category pills + sort */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <CategoryPills
                categories={categories}
                selected={selectedCategory}
                onSelect={setSelectedCategory}
              />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSort(option.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    sort === option.value
                      ? 'bg-[var(--brand-primary-light)] font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                  style={{ color: sort === option.value ? 'var(--brand-primary-dark)' : 'var(--text-secondary)' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          <div className="mt-4">
            <CommunityFeed category={selectedCategory} sort={sort} />
          </div>
        </div>

        {/* Trending sidebar (desktop only) */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-20">
            <TrendingSidebar categories={categories} />
          </div>
        </div>
      </div>
    </div>
  )
}
