'use client'

import Link from 'next/link'
import Image from 'next/image'
import { WantCarLogo } from '@/components/WantCarLogo'
import { SearchModal } from '@/components/SearchModal'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/config/categories'
import { isValidImageUrl } from '@/lib/security'
import { useState, useEffect, useRef } from 'react'

interface Brand {
  name: string
  logoUrl: string
}

interface CountryBrands {
  country: string
  brands: Brand[]
}

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
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set())
  const lastScrollY = useRef(0)
  const isTransitioning = useRef(false)
  const brandScrollRef = useRef<HTMLDivElement>(null)
  const expandedUserMenuRef = useRef<HTMLDivElement>(null)
  const collapsedUserMenuRef = useRef<HTMLDivElement>(null)

  const toggleCountry = (country: string) => {
    setExpandedCountries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(country)) {
        newSet.delete(country)
      } else {
        newSet.add(country)
      }
      return newSet
    })
  }

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

  const scrollBrandsRight = () => {
    if (brandScrollRef.current) {
      brandScrollRef.current.scrollBy({ left: 400, behavior: 'smooth' })
    }
  }

  return (
    <>
      <header className="bg-(--background) sticky top-0 z-30">
        {/* 展開狀態 - 第1行：Logo + Slogan | 搜尋 */}
        <div
          className="border-b"
          style={{
            borderColor: '#cdcdcd',
            height: isScrolled ? '0' : '73px',
            overflow: 'hidden'
          }}
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-4 h-full">
            <div className="flex items-center justify-between h-full">
              {/* Logo + Slogan */}
              <Link href="/" className="flex items-center group">
                <WantCarLogo className="transition-transform group-hover:scale-105" size={40} />
                <span className="ml-4 text-sm font-medium hidden lg:block" style={{ color: '#808080' }}>
                  想要車？從數據到動力，AI 帶你玩懂車界未來
                </span>
              </Link>

              {/* 右側功能：搜尋 + 會員 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded"
                  style={{ color: '#404040' }}
                  aria-label="搜尋"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>

                {/* 會員按鈕 */}
                {loading ? (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-[#FFBB00] rounded-full animate-spin" />
                  </div>
                ) : user ? (
                  <div className="relative" ref={expandedUserMenuRef}>
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded transition-colors"
                      aria-label="用戶選單"
                    >
                      {profile?.avatar_url && isValidImageUrl(profile.avatar_url) ? (
                        <Image
                          src={profile.avatar_url}
                          alt={profile.display_name || 'User'}
                          width={32}
                          height={32}
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#FFBB00] flex items-center justify-center">
                          <span className="text-sm font-bold" style={{ color: '#404040' }}>
                            {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* 用戶下拉選單 */}
                    {isUserMenuOpen && (
                      <div
                        className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50"
                        style={{ borderColor: '#cdcdcd' }}
                      >
                        <div className="px-4 py-2 border-b" style={{ borderColor: '#e5e5e5' }}>
                          <p className="text-sm font-medium" style={{ color: '#404040' }}>
                            {profile?.display_name || user.email}
                          </p>
                          {profile?.display_name && (
                            <p className="text-xs" style={{ color: '#808080' }}>
                              {user.email}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            signOut()
                            setIsUserMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                          style={{ color: '#808080' }}
                        >
                          登出
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-4 py-2 text-sm font-medium rounded hover:bg-[#FFCC33] transition-colors"
                    style={{ backgroundColor: '#FFBB00', color: '#404040' }}
                  >
                    登入
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 展開狀態 - 第2行：漢堡選單 | 分類導航（展開時）/ 收合狀態：漢堡+Logo | 搜尋（收合時）*/}
        <div className="">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            {isScrolled ? (
              /* 收合模式：漢堡選單 + Logo | 搜尋 + 會員 */
              <div className="flex items-center justify-between py-3">
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
                  <Link href="/" className="flex items-center">
                    <WantCarLogo size={32} />
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded"
                    style={{ color: '#404040' }}
                    aria-label="搜尋"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>

                  {/* 會員按鈕 - 收合模式 */}
                  {loading ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-[#FFBB00] rounded-full animate-spin" />
                    </div>
                  ) : user ? (
                    <div className="relative" ref={collapsedUserMenuRef}>
                      <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded transition-colors"
                        aria-label="用戶選單"
                      >
                        {profile?.avatar_url && isValidImageUrl(profile.avatar_url) ? (
                          <Image
                            src={profile.avatar_url}
                            alt={profile.display_name || 'User'}
                            width={28}
                            height={28}
                            className="rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#FFBB00] flex items-center justify-center">
                            <span className="text-xs font-bold" style={{ color: '#404040' }}>
                              {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* 用戶下拉選單 */}
                      {isUserMenuOpen && (
                        <div
                          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50"
                          style={{ borderColor: '#cdcdcd' }}
                        >
                          <div className="px-4 py-2 border-b" style={{ borderColor: '#e5e5e5' }}>
                            <p className="text-sm font-medium" style={{ color: '#404040' }}>
                              {profile?.display_name || user.email}
                            </p>
                            {profile?.display_name && (
                              <p className="text-xs" style={{ color: '#808080' }}>
                                {user.email}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              signOut()
                              setIsUserMenuOpen(false)
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                            style={{ color: '#808080' }}
                          >
                            登出
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-medium rounded hover:bg-[#FFCC33] transition-colors"
                      style={{ backgroundColor: '#FFBB00', color: '#404040' }}
                    >
                      登入
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* 展開模式：漢堡選單 | 分類導航 */
              <nav className="flex items-center justify-between">
                <button
                  className="p-4 text-gray-600 hover:bg-gray-100 rounded"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center flex-1 justify-between">
                  <Link
                    href="/latest"
                    className={`py-4 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      currentPath === '/latest'
                        ? 'border-[#FFBB00]'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    style={{ color: currentPath === '/latest' ? '#FFBB00' : '#808080' }}
                  >
                    最新
                  </Link>
                  {CATEGORIES.map(category => (
                    <Link
                      key={category.slug}
                      href={`/category/${category.slug}`}
                      className={`py-4 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        currentPath === `/category/${category.slug}`
                          ? 'border-[#FFBB00]'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ color: currentPath === `/category/${category.slug}` ? '#FFBB00' : '#808080' }}
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
          <div
            className="bg-(--background) border-b"
            style={{
              borderColor: '#cdcdcd',
              height: isScrolled ? '0' : '121px',
              overflow: 'hidden'
            }}
          >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-4 h-full">
            <div className="flex items-center gap-1">
              <div
                ref={brandScrollRef}
                className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1"
              >
                {popularBrands.map((brand) => (
                  <Link
                    key={brand.name}
                    href={`/brand/${brand.name}`}
                    className="flex flex-col items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded transition-colors group flex-shrink-0"
                  >
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <Image
                        src={brand.logoUrl}
                        alt={`${brand.name} logo`}
                        width={48}
                        height={48}
                        className="object-contain filter grayscale group-hover:grayscale-0 transition-all"
                        unoptimized
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: '#808080' }}>
                      {brand.name}
                    </span>
                  </Link>
                ))}
              </div>
              <button
                onClick={scrollBrandsRight}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded transition-colors"
                style={{ color: '#808080' }}
                aria-label="向右滾動更多品牌"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        )}
      </header>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-[85vw] sm:w-80 max-w-sm pb-10 bg-(--background) z-50 transform transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.1)' }}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#cdcdcd' }}>
            <WantCarLogo size={36} />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded"
              style={{ color: '#404040' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sidebar Content */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              <Link
                href="/latest"
                className={`block px-4 py-3 text-sm font-medium rounded transition-colors ${
                  currentPath === '/latest' ? 'bg-[#FFF3CC]' : 'hover:bg-gray-100'
                }`}
                style={{ color: currentPath === '/latest' ? '#FFBB00' : '#808080' }}
                onClick={() => setIsSidebarOpen(false)}
              >
                最新
              </Link>
              {CATEGORIES.map(category => (
                <Link
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className={`block px-4 py-3 text-sm font-medium rounded transition-colors ${
                    currentPath === `/category/${category.slug}` ? 'bg-[#FFF3CC]' : 'hover:bg-gray-100'
                  }`}
                  style={{ color: currentPath === `/category/${category.slug}` ? '#FFBB00' : '#808080' }}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {category.name}
                </Link>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t" style={{ borderColor: '#cdcdcd' }}>
              <h3 className="px-4 mb-3 text-xs font-bold" style={{ color: '#808080' }}>
                熱門品牌
              </h3>
              <div className="space-y-2">
                {brandsByCountry.map((countryGroup) => (
                  <div key={countryGroup.country}>
                    {/* Country Header - Clickable to expand/collapse */}
                    <button
                      onClick={() => toggleCountry(countryGroup.country)}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100 rounded transition-colors"
                    >
                      <span className="text-sm font-medium" style={{ color: '#404040' }}>
                        {countryGroup.country}
                      </span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedCountries.has(countryGroup.country) ? 'rotate-180' : ''}`}
                        style={{ color: '#808080' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Brand List - Show when expanded */}
                    {expandedCountries.has(countryGroup.country) && (
                      <div className="space-y-1 pl-2">
                        {countryGroup.brands.map((brand) => (
                          <Link
                            key={brand.name}
                            href={`/brand/${brand.name}`}
                            className="flex items-center gap-3 px-4 py-2 rounded hover:bg-gray-100 transition-colors group"
                            onClick={() => setIsSidebarOpen(false)}
                          >
                            <div className="relative w-8 h-8 flex items-center justify-center">
                              <Image
                                src={brand.logoUrl}
                                alt={`${brand.name} logo`}
                                width={32}
                                height={32}
                                className="object-contain filter grayscale group-hover:grayscale-0 transition-all"
                                unoptimized
                              />
                            </div>
                            <span className="text-sm" style={{ color: '#404040' }}>
                              {brand.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  )
}
