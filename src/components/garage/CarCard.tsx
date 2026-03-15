import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface CarCardProps {
  car: {
    id: string
    brand: string
    model: string
    year?: number
    nickname?: string
    color?: string
    cover_image?: string
    owner?: {
      id: string
      username?: string
      display_name?: string
      avatar_url?: string
    }
  }
  showOwner?: boolean
}

export function CarCard({ car, showOwner = true }: CarCardProps) {
  return (
    <Link
      href={`/garage/${car.id}`}
      className="block bg-white rounded-lg border overflow-hidden transition-colors hover:border-[var(--brand-primary)]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      {/* 封面 */}
      <div className="aspect-video bg-gray-100 relative">
        {car.cover_image && isValidImageUrl(car.cover_image) ? (
          <Image src={car.cover_image} alt={`${car.brand} ${car.model}`} fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
        )}
      </div>

      {/* 資訊 */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--brand-primary-lighter)] font-medium" style={{ color: 'var(--text-primary)' }}>
            {car.brand}
          </span>
          {car.year && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{car.year}</span>
          )}
        </div>
        <h3 className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
          {car.nickname || `${car.brand} ${car.model}`}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {car.model} {car.color && `· ${car.color}`}
        </p>

        {showOwner && car.owner && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: '#e5e5e5' }}>
            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
              {car.owner.avatar_url && isValidImageUrl(car.owner.avatar_url) ? (
                <Image src={car.owner.avatar_url} alt="" width={20} height={20} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                  <span className="text-[8px] font-bold">{car.owner.display_name?.[0] || 'U'}</span>
                </div>
              )}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {car.owner.display_name || '匿名'}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
