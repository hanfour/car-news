'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  post_count: number
}

interface TrendingSidebarProps {
  categories: Category[]
}

export function TrendingSidebar({ categories }: TrendingSidebarProps) {
  const topCategories = [...categories]
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 6)

  return (
    <div className="space-y-4">
      {/* 熱門分類 */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          熱門分類
        </h3>
        <div className="space-y-2">
          {topCategories.map(cat => (
            <Link
              key={cat.id}
              href={`/community/${cat.slug}`}
              className="flex items-center justify-between py-1.5 text-sm hover:text-[var(--brand-primary)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>{cat.icon && `${cat.icon} `}{cat.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{cat.post_count} 討論</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 快速連結 */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          探索更多
        </h3>
        <div className="space-y-2">
          <Link
            href="/clubs"
            className="flex items-center gap-2 py-1.5 text-sm hover:text-[var(--brand-primary)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>👥</span> 車友會
          </Link>
          <Link
            href="/garage"
            className="flex items-center gap-2 py-1.5 text-sm hover:text-[var(--brand-primary)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>🚗</span> 愛車展示
          </Link>
        </div>
      </div>
    </div>
  )
}
