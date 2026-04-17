'use client'

import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { FollowButton } from './FollowButton'

interface UserCardProps {
  user: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    bio?: string
  }
  showFollowButton?: boolean
}

export function UserCard({ user, showFollowButton = true }: UserCardProps) {
  const displayUsername = user.username || user.id
  const profileUrl = `/user/${displayUsername}`

  return (
    <div
      className="flex items-center gap-3 p-4 bg-white rounded-lg border transition-colors hover:border-[var(--brand-primary)]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <Link href={profileUrl} className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden">
          {user.avatar_url && isValidImageUrl(user.avatar_url) ? (
            <Image
              src={user.avatar_url}
              alt={user.display_name || 'User'}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
              <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {user.display_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={profileUrl}>
          <p className="text-sm font-medium truncate hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
            {user.display_name || '匿名用戶'}
          </p>
          {user.username && (
            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
              @{user.username}
            </p>
          )}
        </Link>
        {user.bio && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
            {user.bio}
          </p>
        )}
      </div>

      {showFollowButton && (
        <FollowButton targetUsername={displayUsername} targetUserId={user.id} />
      )}
    </div>
  )
}
