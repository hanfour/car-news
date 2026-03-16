'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/config/categories'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAuth } from '@/contexts/AuthContext'
import { ClubSidebarList } from './ClubSidebarList'

const communityLinks = [
  { href: '/community', label: '討論區', icon: '💬' },
  { href: '/garage', label: '愛車展示', icon: '🚗' },
  { href: '/clubs', label: '車友會', icon: '👥' },
  { href: '/feed', label: '動態', icon: '📢' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useNavigation()
  const { user } = useAuth()

  const isActive = (href: string) => {
    if (href === '/community') return pathname === '/community' || pathname.startsWith('/community/')
    return pathname === href || pathname.startsWith(href + '/')
  }

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
      isActive(href) ? 'bg-[var(--brand-primary-light)] font-medium' : 'hover:bg-gray-100'
    }`

  const linkColor = (href: string) =>
    isActive(href) ? 'var(--brand-primary-dark)' : 'var(--text-secondary)'

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[260px] bg-[var(--background)] z-50 border-r overflow-y-auto transform transition-transform duration-200 lg:translate-x-0 lg:top-14 lg:z-20 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 lg:hidden border-b" style={{ borderColor: 'var(--border-color)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>選單</span>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="p-3 space-y-6">
          {/* 新聞區 */}
          <div>
            <h3 className="px-3 mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              新聞
            </h3>
            <div className="space-y-0.5">
              <Link
                href="/latest"
                className={linkClass('/latest')}
                style={{ color: linkColor('/latest') }}
                onClick={() => setSidebarOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                最新
              </Link>
              {CATEGORIES.map(cat => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className={linkClass(`/category/${cat.slug}`)}
                  style={{ color: linkColor(`/category/${cat.slug}`) }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="w-4 text-center text-xs">📰</span>
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          {/* 社群區 */}
          <div>
            <h3 className="px-3 mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              社群
            </h3>
            <div className="space-y-0.5">
              {communityLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClass(link.href)}
                  style={{ color: linkColor(link.href) }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="w-4 text-center text-xs">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* 車友會區 (logged in only) */}
          {user && (
            <div>
              <h3 className="px-3 mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                我的車友會
              </h3>
              <ClubSidebarList />
            </div>
          )}
        </nav>
      </aside>
    </>
  )
}
