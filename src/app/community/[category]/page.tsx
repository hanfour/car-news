'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CommunityFeed } from '@/components/community/CommunityFeed'
import { CommunityComposeTrigger } from '@/components/community/CommunityComposeTrigger'

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  post_count: number
}

type SortOption = 'latest' | 'popular' | 'active'

export default function CategoryPage() {
  const params = useParams()
  const categorySlug = params.category as string
  const [category, setCategory] = useState<Category | null>(null)
  const [sort, setSort] = useState<SortOption>('latest')

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const res = await fetch('/api/forum/categories')
        if (res.ok) {
          const data = await res.json()
          const found = data.categories?.find((c: Category) => c.slug === categorySlug)
          setCategory(found || null)
        }
      } catch { /* */ }
    }
    fetchCategory()
  }, [categorySlug])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Link href="/community" className="hover:text-[var(--brand-primary)] transition-colors">
          社群
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>
          {category?.icon && `${category.icon} `}{category?.name || categorySlug}
        </span>
      </div>

      {/* Category header */}
      {category && (
        <div className="bg-white rounded-xl border p-5 mb-4" style={{ borderColor: 'var(--border-color)' }}>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {category.icon && `${category.icon} `}{category.name}
          </h1>
          {category.description && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {category.description}
            </p>
          )}
          <span className="text-xs mt-2 inline-block" style={{ color: 'var(--text-tertiary)' }}>
            {category.post_count} 篇討論
          </span>
        </div>
      )}

      {/* Compose trigger */}
      <CommunityComposeTrigger />

      {/* Sort tabs */}
      <div className="flex items-center gap-1 mt-4 mb-4">
        {(['latest', 'popular', 'active'] as const).map(option => (
          <button
            key={option}
            onClick={() => setSort(option)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              sort === option
                ? 'bg-[var(--brand-primary-light)] font-medium'
                : 'hover:bg-gray-100'
            }`}
            style={{ color: sort === option ? 'var(--brand-primary-dark)' : 'var(--text-secondary)' }}
          >
            {{ latest: '最新', popular: '熱門', active: '活躍' }[option]}
          </button>
        ))}
      </div>

      {/* Feed */}
      <CommunityFeed category={categorySlug} sort={sort} />
    </div>
  )
}
