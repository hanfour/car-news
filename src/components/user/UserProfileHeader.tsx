'use client'

import Image from 'next/image'
import Link from 'next/link'
import { isValidImageUrl } from '@/lib/security'

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  location?: string
  cover_image_url?: string
  is_favorites_public?: boolean
  followers_count?: number
  following_count?: number
  comments_count?: number
  created_at: string
}

interface UserProfileHeaderProps {
  profile: UserProfile
  isSelf: boolean
  activeTab: 'comments' | 'favorites'
}

export function UserProfileHeader({ profile, isSelf, activeTab }: UserProfileHeaderProps) {
  const displayUsername = profile.username || profile.id
  const joinDate = new Date(profile.created_at).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
  })

  return (
    <div>
      {/* 封面圖片 */}
      <div
        className="h-32 sm:h-48 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] relative"
      >
        {profile.cover_image_url && isValidImageUrl(profile.cover_image_url) && (
          <Image
            src={profile.cover_image_url}
            alt="封面"
            fill
            className="object-cover"
            unoptimized
          />
        )}
      </div>

      {/* 個人資訊 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-12 sm:-mt-16 flex flex-col sm:flex-row sm:items-end gap-4 pb-4">
          {/* 頭像 */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white bg-white overflow-hidden flex-shrink-0">
            {profile.avatar_url && isValidImageUrl(profile.avatar_url) ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name || 'User'}
                width={128}
                height={128}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {profile.display_name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </div>

          {/* 名字與資訊 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {profile.display_name || '匿名用戶'}
                </h1>
                {profile.username && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    @{profile.username}
                  </p>
                )}
              </div>
              {isSelf && (
                <Link
                  href="/settings/profile"
                  className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50 flex-shrink-0"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  編輯個人檔案
                </Link>
              )}
            </div>

            {profile.bio && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                {profile.bio}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {profile.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-[var(--brand-primary)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {new URL(profile.website).hostname}
                </a>
              )}
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {joinDate} 加入
              </span>
            </div>

            {/* 統計 */}
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile.comments_count || 0}</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>則評論</span>
              </span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile.followers_count || 0}</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>粉絲</span>
              </span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile.following_count || 0}</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>追蹤中</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Link
            href={`/user/${displayUsername}`}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'comments'
                ? 'border-[var(--brand-primary)]'
                : 'border-transparent hover:border-gray-300'
            }`}
            style={{ color: activeTab === 'comments' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
          >
            評論
          </Link>
          <Link
            href={`/user/${displayUsername}/favorites`}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'favorites'
                ? 'border-[var(--brand-primary)]'
                : 'border-transparent hover:border-gray-300'
            }`}
            style={{ color: activeTab === 'favorites' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
          >
            收藏
          </Link>
        </div>
      </div>
    </div>
  )
}
