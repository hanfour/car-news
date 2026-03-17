'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from './AppShell'

// Pages that use their own layout (StickyHeader, no AppShell)
const STANDALONE_PATHS = ['/', '/admin', '/auth', '/latest', '/category', '/brand', '/dmca', '/copyright']

// Article detail pages: /YYYY/MM/ID pattern
const ARTICLE_DETAIL_PATTERN = /^\/\d{4}\/\d{2}\//

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isStandalone = STANDALONE_PATHS.some(path => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }) || ARTICLE_DETAIL_PATTERN.test(pathname)

  if (isStandalone) {
    return <>{children}</>
  }

  return <AppShell>{children}</AppShell>
}
