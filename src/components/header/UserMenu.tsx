'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { RefObject } from 'react'
import type { User } from '@supabase/supabase-js'
import { isValidImageUrl } from '@/lib/security'

type Profile = {
  display_name?: string | null
  avatar_url?: string | null
  username?: string | null
} | null

interface UserMenuProps {
  variant: 'expanded' | 'collapsed'
  user: User
  profile: Profile
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSignOut: () => void | Promise<void>
  /**
   * Ref 指向 outer wrapper（包含 button + dropdown），供 parent 做 click-outside。
   * 原本 StickyHeader expanded 變體會把同一 ref 重複指派給內層 dropdown，
   * 造成 open 後 ref.current 指向 dropdown、使點按鈕被判為「outside」→
   * onToggle(open) 與 click-outside(close) 互相取消；已於此修掉。
   */
  wrapperRef: RefObject<HTMLDivElement | null>
}

export function UserMenu({
  variant,
  user,
  profile,
  isOpen,
  onToggle,
  onClose,
  onSignOut,
  wrapperRef,
}: UserMenuProps) {
  const isExpanded = variant === 'expanded'
  const avatarSize = isExpanded ? 32 : 28
  const avatarFallbackSizeClass = isExpanded ? 'w-8 h-8' : 'w-7 h-7'
  const avatarFallbackTextSizeClass = isExpanded ? 'text-sm' : 'text-xs'

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded transition-colors"
        aria-label="用戶選單"
      >
        {profile?.avatar_url && isValidImageUrl(profile.avatar_url) ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name || 'User'}
            width={avatarSize}
            height={avatarSize}
            className="rounded-full object-cover"
          />
        ) : (
          <div className={`${avatarFallbackSizeClass} rounded-full bg-[var(--brand-primary)] flex items-center justify-center`}>
            <span className={`${avatarFallbackTextSizeClass} font-bold`} style={{ color: 'var(--text-primary)' }}>
              {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
        )}
      </button>

      {/* 用戶下拉選單（不帶 ref，靠 outer wrapper 的 ref 給 click-outside 用） */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1"
          style={{ borderColor: '#cdcdcd', zIndex: 9999 }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: '#e5e5e5' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {profile?.display_name || user.email}
            </p>
            {profile?.display_name && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {user.email}
              </p>
            )}
          </div>
          <Link
            href={`/user/${profile?.username || user.id}`}
            onClick={onClose}
            className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            個人頁面
          </Link>
          <Link
            href="/settings/profile"
            onClick={onClose}
            className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            設定
          </Link>
          <button
            onClick={() => {
              onSignOut()
              onClose()
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            登出
          </button>
        </div>
      )}
    </div>
  )
}
