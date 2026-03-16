'use client'

import { useAuth } from '@/contexts/AuthContext'
import { ProfileEditForm } from '@/components/user/ProfileEditForm'

export default function ProfileSettingsPage() {
  const { profile } = useAuth()

  if (!profile) return null

  return (
    <div>
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          編輯個人檔案
        </h2>

        {!profile.username && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--brand-primary-lighter)', color: 'var(--text-primary)' }}
          >
            歡迎！請先設定您的用戶名稱。
          </div>
        )}

        <ProfileEditForm profile={profile} />
      </div>
    </div>
  )
}
