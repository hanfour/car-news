'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from './AppShell'

// Pages that use their own layout (no AppShell)
const STANDALONE_PATHS = ['/', '/admin', '/auth']

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isStandalone = STANDALONE_PATHS.some(path => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  })

  if (isStandalone) {
    return <>{children}</>
  }

  return <AppShell>{children}</AppShell>
}
