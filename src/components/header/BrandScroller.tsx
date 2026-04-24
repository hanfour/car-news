'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRef } from 'react'
import type { Brand } from './types'

interface BrandScrollerProps {
  popularBrands: Brand[]
  isScrolled: boolean
}

export function BrandScroller({ popularBrands, isScrolled }: BrandScrollerProps) {
  const brandScrollRef = useRef<HTMLDivElement>(null)

  const scrollBrandsRight = () => {
    if (brandScrollRef.current) {
      brandScrollRef.current.scrollBy({ left: 400, behavior: 'smooth' })
    }
  }

  return (
    <div
      className="bg-[var(--background)] border-b"
      style={{
        borderColor: '#cdcdcd',
        height: isScrolled ? '0' : '121px',
        overflow: 'hidden'
      }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-12 py-4 h-full overflow-hidden">
        <div className="w-full h-full overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0.5">
            <div
              ref={brandScrollRef}
              className="flex items-center gap-0.5"
            >
              {popularBrands.map((brand) => (
                <Link
                  key={brand.name}
                  href={`/brand/${brand.name}`}
                  prefetch={false}
                  className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded transition-colors group flex-shrink-0"
                >
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <Image
                      src={brand.logoUrl}
                      alt={`${brand.name} logo`}
                      width={48}
                      height={48}
                      className="object-contain filter grayscale group-hover:grayscale-0 transition-all"
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {brand.name}
                  </span>
                </Link>
              ))}
            </div>
            <button
              onClick={scrollBrandsRight}
              className="hidden flex-shrink-0 p-2 hover:bg-gray-100 rounded transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="向右滾動更多品牌"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
