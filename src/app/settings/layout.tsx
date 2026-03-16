'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'

const settingsNav = [
  { href: '/settings/profile', label: '個人資料', icon: '👤' },
  { href: '/settings/notifications', label: '通知設定', icon: '🔔' },
  { href: '/settings/privacy', label: '隱私', icon: '🔒' },
  { href: '/settings/account', label: '帳號', icon: '⚙️' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()

  if (loading) return <LoadingCenter size="lg" />

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>請先登入</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>設定</h1>

      <div className="flex gap-6">
        {/* Settings nav (desktop sidebar) */}
        <nav className="hidden sm:block w-48 flex-shrink-0">
          <div className="space-y-1 sticky top-20">
            {settingsNav.map(item => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive ? 'bg-[var(--brand-primary-light)] font-medium' : 'hover:bg-gray-100'
                  }`}
                  style={{ color: isActive ? 'var(--brand-primary-dark)' : 'var(--text-secondary)' }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Mobile tabs */}
        <div className="sm:hidden w-full">
          <div className="flex overflow-x-auto scrollbar-hide gap-1 mb-4">
            {settingsNav.map(item => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                    isActive ? 'bg-[var(--brand-primary)] font-medium' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 hidden sm:block">
          {children}
        </div>
      </div>

      {/* Mobile content (full width) */}
      <div className="sm:hidden">
        {children}
      </div>
    </div>
  )
}
