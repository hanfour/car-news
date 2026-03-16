'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const tabs = [
  {
    href: '/latest',
    label: '新聞',
    matchPaths: ['/', '/latest', '/category', '/brand'],
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
  {
    href: '/community',
    label: '社群',
    matchPaths: ['/community'],
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
  {
    href: '/clubs',
    label: '車友會',
    matchPaths: ['/clubs'],
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/me',
    label: '我的',
    matchPaths: ['/user', '/settings', '/garage/my'],
    isProfile: true,
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const { user, profile } = useAuth()

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.href === '/latest') {
      return pathname === '/' || tab.matchPaths.some(p => pathname.startsWith(p))
    }
    return tab.matchPaths.some(p => pathname.startsWith(p))
  }

  const getHref = (tab: typeof tabs[0]) => {
    if (tab.isProfile) {
      if (user) return `/user/${profile?.username || user.id}`
      return '/settings/profile'
    }
    return tab.href
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t lg:hidden" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center justify-around h-14 safe-area-pb">
        {tabs.map(tab => {
          const active = isActive(tab)
          return (
            <Link
              key={tab.href}
              href={getHref(tab)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors"
              style={{ color: active ? 'var(--brand-primary)' : 'var(--text-tertiary)' }}
            >
              {tab.icon(active)}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
