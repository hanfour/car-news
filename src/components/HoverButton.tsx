'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface HoverButtonProps {
  href: string
  className?: string
  baseColor: string
  hoverColor: string
  children: ReactNode
}

/**
 * A client component for buttons with hover background color effects
 * Used in server components where event handlers are not allowed
 */
export function HoverButton({
  href,
  className = '',
  baseColor,
  hoverColor,
  children
}: HoverButtonProps) {
  return (
    <Link
      href={href}
      className={className}
      style={{ backgroundColor: baseColor }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = baseColor
      }}
    >
      {children}
    </Link>
  )
}
