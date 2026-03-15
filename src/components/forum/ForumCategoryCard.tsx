import Link from 'next/link'

interface ForumCategoryCardProps {
  category: {
    id: string
    name: string
    slug: string
    description?: string
    icon?: string
    post_count: number
  }
}

export function ForumCategoryCard({ category }: ForumCategoryCardProps) {
  return (
    <Link
      href={`/community/${category.slug}`}
      className="block bg-white rounded-lg border p-4 transition-colors hover:border-[var(--brand-primary)]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3">
        {category.icon && (
          <span className="text-2xl">{category.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {category.name}
          </h3>
          {category.description && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {category.description}
            </p>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100" style={{ color: 'var(--text-tertiary)' }}>
          {category.post_count} 篇
        </span>
      </div>
    </Link>
  )
}
