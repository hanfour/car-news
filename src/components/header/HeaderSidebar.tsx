'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { WantCarLogo } from '@/components/WantCarLogo'
import { CATEGORIES } from '@/config/categories'
import type { CountryBrands } from './types'

interface HeaderSidebarProps {
  isOpen: boolean
  onClose: () => void
  brandsByCountry: CountryBrands[]
  currentPath: string
  user: User | null
}

export function HeaderSidebar({
  isOpen,
  onClose,
  brandsByCountry,
  currentPath,
  user,
}: HeaderSidebarProps) {
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set())

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

  return (
    <div
      className={`fixed top-0 left-0 bottom-0 w-[85vw] sm:w-80 max-w-sm pb-10 bg-[var(--background)] z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        height: '100%'
      }}
    >
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#cdcdcd' }}>
          <WantCarLogo size={36} />
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            style={{ color: 'var(--text-primary)' }}
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
              prefetch={false}
              className={`block px-4 py-3 text-sm font-medium rounded transition-colors ${
                currentPath === '/latest' ? 'bg-[#FFF3CC]' : 'hover:bg-gray-100'
              }`}
              style={{ color: currentPath === '/latest' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
              onClick={onClose}
            >
              最新
            </Link>
            {CATEGORIES.map(category => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                prefetch={false}
                className={`block px-4 py-3 text-sm font-medium rounded transition-colors ${
                  currentPath === `/category/${category.slug}` ? 'bg-[#FFF3CC]' : 'hover:bg-gray-100'
                }`}
                style={{ color: currentPath === `/category/${category.slug}` ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
                onClick={onClose}
              >
                {category.name}
              </Link>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t" style={{ borderColor: '#cdcdcd' }}>
            <h3 className="px-4 mb-3 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
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
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {countryGroup.country}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${expandedCountries.has(countryGroup.country) ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--text-secondary)' }}
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
                          prefetch={false}
                          className="flex items-center gap-3 px-4 py-2 rounded hover:bg-gray-100 transition-colors group"
                          onClick={onClose}
                        >
                          <div className="relative w-8 h-8 flex items-center justify-center">
                            <Image
                              src={brand.logoUrl}
                              alt={`${brand.name} logo`}
                              width={32}
                              height={32}
                              className="object-contain filter grayscale group-hover:grayscale-0 transition-all"
                            />
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
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

          {/* 社群區塊 */}
          <div className="mt-8 pt-8 border-t" style={{ borderColor: '#cdcdcd' }}>
            <h3 className="px-4 mb-3 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
              社群
            </h3>
            <div className="space-y-1">
              <Link
                href="/community"
                prefetch={false}
                className="block px-4 py-3 text-sm font-medium rounded hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={onClose}
              >
                討論區
              </Link>
              <Link
                href="/garage"
                prefetch={false}
                className="block px-4 py-3 text-sm font-medium rounded hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={onClose}
              >
                愛車展示
              </Link>
              <Link
                href="/clubs"
                prefetch={false}
                className="block px-4 py-3 text-sm font-medium rounded hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={onClose}
              >
                車友會
              </Link>
              {user && (
                <Link
                  href="/messages"
                  prefetch={false}
                  className="block px-4 py-3 text-sm font-medium rounded hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={onClose}
                >
                  私訊
                </Link>
              )}
            </div>
          </div>
        </nav>
      </div>
    </div>
  )
}
