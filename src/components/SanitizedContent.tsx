'use client'

import { useEffect, useState } from 'react'

interface SanitizedContentProps {
  html: string
  className?: string
}

/**
 * Client-side component that sanitizes HTML content using DOMPurify
 * to prevent XSS attacks while allowing safe formatting tags
 */
export function SanitizedContent({ html, className }: SanitizedContentProps) {
  const [sanitizedHtml, setSanitizedHtml] = useState('')

  useEffect(() => {
    // Dynamically import DOMPurify only on client-side
    import('dompurify').then((DOMPurify) => {
      const clean = DOMPurify.default.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'h1', 'h2', 'h3', 'h4',
          'strong', 'em', 'u', 'br',
          'ul', 'ol', 'li',
          'code', 'pre', 'blockquote',
          'a'
        ],
        ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
        ALLOW_DATA_ATTR: false
      })
      setSanitizedHtml(clean)
    })
  }, [html])

  // Show loading state while sanitizing
  if (!sanitizedHtml) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
