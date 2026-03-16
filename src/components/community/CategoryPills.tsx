'use client'

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
}

interface CategoryPillsProps {
  categories: Category[]
  selected?: string | null
  onSelect: (slug: string | null) => void
}

export function CategoryPills({ categories, selected, onSelect }: CategoryPillsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
          !selected
            ? 'bg-[var(--brand-primary)] font-medium'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        style={{ color: !selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        全部
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
            selected === cat.slug
              ? 'bg-[var(--brand-primary)] font-medium'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          style={{ color: selected === cat.slug ? 'var(--text-primary)' : 'var(--text-secondary)' }}
        >
          {cat.icon && <span className="mr-1">{cat.icon}</span>}
          {cat.name}
        </button>
      ))}
    </div>
  )
}
