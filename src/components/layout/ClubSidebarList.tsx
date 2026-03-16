'use client'

import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { useNavigation } from '@/contexts/NavigationContext'

export function ClubSidebarList() {
  const { myClubs, loadingClubs } = useNavigation()

  if (loadingClubs) {
    return (
      <div className="space-y-2 px-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full skeleton-light" />
            <div className="h-3 w-20 skeleton-light rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (myClubs.length === 0) {
    return (
      <div className="px-6 py-2">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          尚未加入任何車友會
        </p>
        <Link
          href="/clubs"
          className="text-xs font-medium hover:underline mt-1 inline-block"
          style={{ color: 'var(--brand-primary)' }}
        >
          探索車友會
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 px-3">
      {myClubs.map(club => (
        <Link
          key={club.id}
          href={`/clubs/${club.slug}`}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <Avatar src={club.avatar_url} name={club.name} size={28} />
          <span className="text-sm truncate group-hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
            {club.name}
          </span>
        </Link>
      ))}
      <Link
        href="/clubs"
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: 'var(--text-tertiary)' }}>
          <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          探索更多
        </span>
      </Link>
    </div>
  )
}
