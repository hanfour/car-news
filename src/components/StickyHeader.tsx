'use client'

import Link from 'next/link'
import { WantCarLogo } from '@/components/WantCarLogo'
import { SearchModal } from '@/components/SearchModal'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/config/categories'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useState, useEffect, useRef } from 'react'
import { UserMenu } from '@/components/header/UserMenu'
import { BrandScroller } from '@/components/header/BrandScroller'
import { HeaderSidebar } from '@/components/header/HeaderSidebar'
import type { Brand, CountryBrands } from '@/components/header/types'

interface StickyHeaderProps {
  popularBrands: Brand[]
  brandsByCountry: CountryBrands[]
  showBrands?: boolean
  currentPath?: string
}

export function StickyHeader({ popularBrands, brandsByCountry, showBrands = true, currentPath = '' }: StickyHeaderProps) {
  const { user, profile, loading, signOut } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const lastScrollY = useRef(0)
  const isTransitioning = useRef(false)
  const expandedUserMenuRef = useRef<HTMLDivElement>(null)
  const collapsedUserMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY
          const threshold = 200

          // 使用較大的閾值和方向檢測
          const scrollingDown = scrollY > lastScrollY.current

          if (scrollingDown && scrollY > threshold && !isScrolled && !isTransitioning.current) {
            isTransitioning.current = true
            setIsScrolled(true)
            // 補償高度變化
            setTimeout(() => {
              window.scrollTo({ top: window.scrollY, behavior: 'instant' })
              isTransitioning.current = false
            }, 50)
          } else if (!scrollingDown && scrollY < threshold - 100 && isScrolled && !isTransitioning.current) {
            isTransitioning.current = true
            setIsScrolled(false)
            setTimeout(() => {
              isTransitioning.current = false
            }, 50)
          }

          lastScrollY.current = scrollY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isScrolled])

  // 點擊外部關閉用戶選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const expandedMenu = expandedUserMenuRef.current
      const collapsedMenu = collapsedUserMenuRef.current

      if (expandedMenu && !expandedMenu.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      } else if (collapsedMenu && !collapsedMenu.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isUserMenuOpen])

  return (
    <>
      <header className="bg-[var(--background)] sticky top-0 z-30">
        {/* 展開狀態 - 第1行：Logo + Slogan | 搜尋 */}
        <div
          className="border-b"
          style={{
            borderColor: 'var(--border-color)',
            height: isScrolled ? '0' : '73px',
            overflow: isScrolled ? 'hidden' : 'visible'
          }}
        >
          <div className="w-full px-4 sm:px-6 lg:px-12 py-4 h-full">
            <div className="flex items-center justify-between h-full max-w-[1440px] mx-auto">
              {/* Logo + Slogan */}
              <Link href="/" prefetch={false} className="flex items-center group">
                <WantCarLogo className="transition-transform group-hover:scale-105" size={40} />
                <span className="ml-4 text-sm font-medium hidden lg:block" style={{ color: 'var(--text-secondary)' }}>
                  想要車？從數據到動力，AI 帶你玩懂車界未來
                </span>
              </Link>

              {/* 右側功能：搜尋 + 會員 */}
              <div className="flex items-center gap-2">
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

                {/* 通知鈴鐺 */}
                {user && <NotificationBell />}

                {/* 會員按鈕 */}
                {loading ? (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-(--brand-primary) rounded-full animate-spin" />
                  </div>
                ) : user ? (
                  <UserMenu
                    variant="expanded"
                    user={user}
                    profile={profile}
                    isOpen={isUserMenuOpen}
                    onToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    onClose={() => setIsUserMenuOpen(false)}
                    onSignOut={signOut}
                    wrapperRef={expandedUserMenuRef}
                  />
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="btn-primary"
                  >
                    登入
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 展開狀態 - 第2行：漢堡選單 | 分類導航（展開時）/ 收合狀態：漢堡+Logo | 搜尋（收合時）*/}
        <div className="w-full" style={{ overflow: isUserMenuOpen ? 'visible' : 'auto' }}>
          <div className="px-4 sm:px-6 lg:px-12">
            {isScrolled ? (
              /* 收合模式：漢堡選單 + Logo | 搜尋 + 會員 */
              <div className="flex items-center justify-between py-3 max-w-[1440px] mx-auto">
                <div className="flex items-center gap-3">
                  <button
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    aria-label="選單"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <Link href="/" prefetch={false} className="flex items-center">
                    <WantCarLogo size={32} />
                  </Link>
                </div>

                <div className="flex items-center gap-2">
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

                  {/* 通知鈴鐺 - 收合模式 */}
                  {user && <NotificationBell />}

                  {/* 會員按鈕 - 收合模式 */}
                  {loading ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-(--brand-primary) rounded-full animate-spin" />
                    </div>
                  ) : user ? (
                    <UserMenu
                      variant="collapsed"
                      user={user}
                      profile={profile}
                      isOpen={isUserMenuOpen}
                      onToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      onClose={() => setIsUserMenuOpen(false)}
                      onSignOut={signOut}
                      wrapperRef={collapsedUserMenuRef}
                    />
                  ) : (
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-brand-primary text-text-primary hover:bg-brand-primary-hover transition-colors"
                    >
                      登入
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* 展開模式：漢堡選單 | 分類導航 */
              <nav className="flex items-center justify-between gap-4 sm:gap-6 lg:gap-12">
                <button
                  className="p-4 text-gray-600 hover:bg-gray-100 rounded flex-shrink-0"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex-1 flex items-center justify-between overflow-x-auto scrollbar-hide">
                  <Link
                    href="/latest"
                    prefetch={false}
                    className={`py-4 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      currentPath === '/latest'
                        ? 'border-[var(--brand-primary)]'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    style={{ color: currentPath === '/latest' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
                  >
                    最新
                  </Link>
                  {CATEGORIES.map(category => (
                    <Link
                      key={category.slug}
                      href={`/category/${category.slug}`}
                      prefetch={false}
                      className={`py-4 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        currentPath === `/category/${category.slug}`
                          ? 'border-[var(--brand-primary)]'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ color: currentPath === `/category/${category.slug}` ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </div>

        {/* 展開狀態 - 第3行：品牌 Logo 滾動列表 */}
        {showBrands && (
          <BrandScroller popularBrands={popularBrands} isScrolled={isScrolled} />
        )}
      </header>

      {/* Sidebar */}
      <HeaderSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        brandsByCountry={brandsByCountry}
        currentPath={currentPath}
        user={user}
      />

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  )
}
