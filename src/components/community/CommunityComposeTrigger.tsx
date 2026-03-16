'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/shared/Avatar'

export function CommunityComposeTrigger() {
  const { user, profile, session } = useAuth()

  if (!session) {
    return null
  }

  return (
    <Link
      href="/community/new"
      className="flex items-center gap-3 bg-white rounded-xl border p-4 transition-colors hover:border-[var(--brand-primary)]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <Avatar src={profile?.avatar_url} name={profile?.display_name || user?.email} size={36} />
      <div
        className="flex-1 text-sm rounded-lg px-4 py-2.5 bg-gray-50"
        style={{ color: 'var(--text-tertiary)' }}
      >
        想聊什麼？發起討論...
      </div>
    </Link>
  )
}
