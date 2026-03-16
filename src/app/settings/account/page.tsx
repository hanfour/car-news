'use client'

import { useAuth } from '@/contexts/AuthContext'

export default function AccountSettingsPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="space-y-6">
      {/* Email */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>帳號資訊</h2>

        <div className="py-3">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Email</p>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{user?.email || '-'}</p>
        </div>

        <div className="py-3 border-t" style={{ borderColor: '#e5e5e5' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>登入方式</p>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {user?.app_metadata?.provider === 'google' ? 'Google' : user?.app_metadata?.provider || 'Email'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>操作</h2>

        <div className="space-y-3">
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-3 text-sm rounded-lg border hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            登出
          </button>

          <div className="pt-4 border-t" style={{ borderColor: '#e5e5e5' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              刪除帳號後，所有資料將被永久移除且無法恢復。
            </p>
            <button
              className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-red-50"
              style={{ borderColor: 'var(--brand-red)', color: 'var(--brand-red)' }}
              onClick={() => alert('如需刪除帳號，請聯繫客服')}
            >
              刪除帳號
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
