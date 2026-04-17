'use client'

import { useState } from 'react'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface ImageGalleryProps {
  images: string[]
  alt?: string
}

export function ImageGallery({ images, alt = '' }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const validImages = images.filter(isValidImageUrl)

  if (validImages.length === 0) {
    return (
      <div className="aspect-video bg-gray-100 flex items-center justify-center rounded-xl">
        <span className="text-6xl">🚗</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Main image */}
      <div className="aspect-video bg-gray-100 relative rounded-xl overflow-hidden">
        <Image
          src={validImages[currentIndex]}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          className="object-cover"
        />

        {/* Navigation arrows */}
        {validImages.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex(i => (i - 1 + validImages.length) % validImages.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentIndex(i => (i + 1) % validImages.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {validImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {validImages.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
          {validImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                i === currentIndex ? 'border-[var(--brand-primary)]' : 'border-transparent'
              }`}
            >
              <Image src={img} alt={`縮圖 ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
