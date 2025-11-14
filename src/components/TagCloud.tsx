'use client'

import Link from 'next/link'

interface TagCloudProps {
  tags: { name: string; count: number }[]
}

export function TagCloud({ tags }: TagCloudProps) {
  if (tags.length === 0) return null

  // Calculate font sizes based on count (min: 14px, max: 28px)
  const maxCount = Math.max(...tags.map(t => t.count))
  const minCount = Math.min(...tags.map(t => t.count))
  const range = maxCount - minCount || 1

  const getFontSize = (count: number) => {
    const normalized = (count - minCount) / range
    return 14 + normalized * 14 // 14px to 28px
  }

  return (
    <div className="bg-[var(--brand-primary)] w-full">
      <div className="w-full px-4 sm:px-6 lg:px-12 py-12">
        {/* Section Title */}
        <h2 className="text-2xl font-bold mb-8 text-text-primary font-heading">
          玩咖熱詞
        </h2>

        {/* Tag Cloud */}
        <div className="flex flex-wrap gap-2 items-center">
          {tags.map((tag) => (
            <Link
              key={tag.name}
              href={`/tag/${encodeURIComponent(tag.name)}`}
              prefetch={false}
              className="inline-block px-4 py-2 transition-all duration-200 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white rounded-full border border-[var(--foreground)]"
              style={{
                fontSize: `${getFontSize(tag.count)}px`,
                fontWeight: tag.count > maxCount * 0.7 ? 700 : 500,
                lineHeight: '1.5'
              }}
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
