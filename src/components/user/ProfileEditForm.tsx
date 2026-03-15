'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AvatarUploader } from './AvatarUploader'

interface ProfileEditFormProps {
  profile: {
    username?: string
    display_name?: string
    bio?: string
    website?: string
    location?: string
    avatar_url?: string
    is_favorites_public?: boolean
  }
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const { session, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    username: profile.username || '',
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    website: profile.website || '',
    location: profile.location || '',
    is_favorites_public: profile.is_favorites_public || false,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          website: form.website || null,
          location: form.location || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '更新失敗' })
        return
      }

      setMessage({ type: 'success', text: '個人檔案已更新' })
      await refreshProfile()
    } catch {
      setMessage({ type: 'error', text: '系統錯誤，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 頭像 */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          頭像
        </label>
        <AvatarUploader currentAvatar={profile.avatar_url} />
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          用戶名稱
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
          英文字母、數字和底線，3-30 字元。設定後將作為個人頁面網址
        </p>
        <div className="flex items-center">
          <span className="text-sm mr-1" style={{ color: 'var(--text-secondary)' }}>@</span>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
            placeholder="your_username"
            pattern="^[a-zA-Z0-9_]{3,30}$"
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          顯示名稱
        </label>
        <input
          type="text"
          value={form.display_name}
          onChange={(e) => setForm(prev => ({ ...prev, display_name: e.target.value }))}
          maxLength={50}
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          自我介紹
        </label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
          maxLength={300}
          rows={3}
          className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
        <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-tertiary)' }}>
          {form.bio.length}/300
        </p>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          所在地
        </label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
          placeholder="例：台北市"
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          個人網站
        </label>
        <input
          type="url"
          value={form.website}
          onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
          placeholder="https://example.com"
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Privacy */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="is_favorites_public"
          checked={form.is_favorites_public}
          onChange={(e) => setForm(prev => ({ ...prev, is_favorites_public: e.target.checked }))}
          className="w-4 h-4 accent-[var(--brand-primary)]"
        />
        <label htmlFor="is_favorites_public" className="text-sm" style={{ color: 'var(--text-primary)' }}>
          公開我的收藏列表
        </label>
      </div>

      {/* Message */}
      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: message.type === 'success' ? 'var(--brand-primary-lighter)' : '#FEE2E2',
            color: message.type === 'success' ? 'var(--text-primary)' : 'var(--brand-red)',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving}
        className="btn-primary w-full disabled:opacity-60"
      >
        {saving ? '儲存中...' : '儲存變更'}
      </button>
    </form>
  )
}
