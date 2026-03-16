'use client'

import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { Avatar } from '@/components/shared/Avatar'
import { JoinClubButton } from '@/components/clubs/JoinClubButton'

interface Club {
  id: string
  name: string
  slug: string
  description?: string
  brand?: string
  model?: string
  cover_image?: string
  avatar_url?: string
  owner_id: string
  member_count: number
  post_count: number
  rules?: string
  is_private?: boolean
}

interface ClubHeaderProps {
  club: Club
  isMember: boolean
  isOwner: boolean
  onStatusChange: () => void
}

export function ClubHeader({ club, isMember, isOwner, onStatusChange }: ClubHeaderProps) {
  return (
    <div>
      {/* Banner */}
      <div className="h-32 sm:h-48 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] relative">
        {club.cover_image && isValidImageUrl(club.cover_image) && (
          <Image src={club.cover_image} alt="" fill className="object-cover" unoptimized />
        )}
      </div>

      {/* Club info */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative">
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-start gap-4">
            <div className="-mt-12 flex-shrink-0 border-4 border-white rounded-xl overflow-hidden">
              <Avatar src={club.avatar_url} name={club.name} size={72} className="rounded-xl" />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{club.name}</h1>
                  {club.description && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {club.description}
                    </p>
                  )}
                </div>
                <JoinClubButton slug={club.slug} isMember={isMember} isOwner={isOwner} onStatusChange={onStatusChange} />
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {club.brand && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--brand-primary-lighter)]" style={{ color: 'var(--text-primary)' }}>
                    {club.brand}{club.model ? ` ${club.model}` : ''}
                  </span>
                )}
                <span className="font-medium">{club.member_count} 成員</span>
                <span>{club.post_count} 貼文</span>
                {club.is_private && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    私人
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
