'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WantCarLogo } from '@/components/WantCarLogo'
import { SearchModal } from '@/components/SearchModal'
import { AuthModal } from '@/components/AuthModal'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Avatar } from '@/components/shared/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'

export function AppTopBar() {
  const { user, profile, loading, signOut } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useNavigation()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--background)] border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-3">
            <button
              className="p-2 hover:bg-gray-100 rounded lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="選單"
            >
              <svg className="w-5 h-5" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" prefetch={false} className="flex items-center">
              <WantCarLogo size={32} />
              <span className="ml-2 text-sm font-bold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
                玩咖
              </span>
            </Link>
          </div>

          {/* Right: search + notification + user */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-gray-100 rounded"
              style={{ color: 'var(--text-primary)' }}
              aria-label="搜尋"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {user && <NotificationBell />}

            {loading ? (
              <div className="w-8 h-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
              </div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="用戶選單"
                >
                  <Avatar src={profile?.avatar_url} name={profile?.display_name || user.email} size={30} />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50"
                      style={{ borderColor: '#cdcdcd' }}
                    >
                      <div className="px-4 py-2 border-b" style={{ borderColor: '#e5e5e5' }}>
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {profile?.display_name || user.email}
                        </p>
                        {profile?.username && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            @{profile.username}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/user/${profile?.username || user.id}`}
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        個人頁面
                      </Link>
                      <Link
                        href="/garage/my"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        我的車庫
                      </Link>
                      <Link
                        href="/settings/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        設定
                      </Link>
                      <div className="border-t my-1" style={{ borderColor: '#e5e5e5' }} />
                      <button
                        onClick={() => { signOut(); setIsUserMenuOpen(false) }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        登出
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="btn-primary text-sm"
              >
                登入
              </button>
            )}
          </div>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  )
}
