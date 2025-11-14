'use client'

import Link from 'next/link'

interface BrandTagProps {
  brand: string
}

/**
 * Client component for brand tags with hover effect
 * Background color changes on hover while text color remains constant
 */
export function BrandTag({ brand }: BrandTagProps) {
  return (
    <Link
      href={`/brand/${brand}`}
      className="px-3 py-1 text-xs font-medium rounded-full transition-colors"
      style={{
        backgroundColor: 'var(--brand-primary-lighter)',
        color: 'var(--brand-primary-dark)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--brand-primary-light)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--brand-primary-lighter)'
      }}
    >
      {brand}
    </Link>
  )
}
