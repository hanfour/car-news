'use client'

import { useAuth } from '@/contexts/AuthContext'
import { ProfileEditForm } from '@/components/user/ProfileEditForm'
import Link from 'next/link'

export default function ProfileSettingsPage() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            請先登入
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            登入後即可編輯個人檔案
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/" className="hover:text-[var(--brand-primary)] transition-colors">
            首頁
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>個人設定</span>
        </div>

        <div className="bg-white rounded-xl border p-6 sm:p-8" style={{ borderColor: 'var(--border-color)' }}>
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            編輯個人檔案
          </h1>

          {!profile.username && (
            <div
              className="mb-6 px-4 py-3 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--brand-primary-lighter)', color: 'var(--text-primary)' }}
            >
              歡迎！請先設定您的用戶名稱，這將作為您的個人頁面網址。
            </div>
          )}

          <ProfileEditForm profile={profile} />
        </div>
      </div>
    </div>
  )
}
