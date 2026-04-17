import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface ClubCardProps {
  club: {
    id: string
    name: string
    slug: string
    description?: string
    brand?: string
    avatar_url?: string
    member_count: number
    post_count: number
  }
}

export function ClubCard({ club }: ClubCardProps) {
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="block bg-white rounded-lg border p-4 transition-colors hover:border-[var(--brand-primary)]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          {club.avatar_url && isValidImageUrl(club.avatar_url) ? (
            <Image src={club.avatar_url} alt={club.name} width={48} height={48} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[var(--brand-primary-lighter)] flex items-center justify-center">
              <span className="text-lg font-bold" style={{ color: 'var(--brand-primary-dark)' }}>
                {club.name[0]}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {club.name}
          </h3>
          {club.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
              {club.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {club.brand && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--brand-primary-lighter)]">
                {club.brand}
              </span>
            )}
            <span>{club.member_count} 成員</span>
            <span>{club.post_count} 貼文</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
