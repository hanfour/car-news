'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface HoverLinkProps {
  href: string
  className?: string
  baseColor: string
  hoverColor: string
  children: ReactNode
  target?: string
  rel?: string
}

/**
 * A client component for links with hover color effects
 * Used in server components where event handlers are not allowed
 */
export function HoverLink({
  href,
  className = '',
  baseColor,
  hoverColor,
  children,
  target,
  rel
}: HoverLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      style={{ color: baseColor }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = baseColor
      }}
      target={target}
      rel={rel}
    >
      {children}
    </Link>
  )
}
