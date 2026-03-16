'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'
import { Avatar } from '@/components/shared/Avatar'

interface BlockedUser {
  blocked_id: string
  profile?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

export default function PrivacySettingsPage() {
  const { session, profile, refreshProfile } = useAuth()
  const [isFavoritesPublic, setIsFavoritesPublic] = useState(profile?.is_favorites_public ?? true)
  const [saving, setSaving] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(true)

  useEffect(() => {
    setIsFavoritesPublic(profile?.is_favorites_public ?? true)
  }, [profile])

  useEffect(() => {
    // For now, blocked users is a placeholder since we need to implement the API
    setLoadingBlocks(false)
  }, [])

  const handleFavoritesToggle = async () => {
    if (!session?.access_token) return
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ is_favorites_public: !isFavoritesPublic }),
      })
      if (res.ok) {
        setIsFavoritesPublic(!isFavoritesPublic)
        refreshProfile()
      }
    } catch { /* */ } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      {/* Favorites privacy */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>隱私設定</h2>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>收藏公開</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>其他人可以看到你收藏的文章</p>
          </div>
          <button
            onClick={handleFavoritesToggle}
            disabled={saving}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isFavoritesPublic ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                isFavoritesPublic ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Blocked users */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>封鎖名單</h2>

        {loadingBlocks ? (
          <LoadingCenter size="sm" />
        ) : blockedUsers.length > 0 ? (
          <div className="space-y-2">
            {blockedUsers.map(bu => (
              <div key={bu.blocked_id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Avatar src={bu.profile?.avatar_url} name={bu.profile?.display_name} size={32} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {bu.profile?.display_name || '匿名'}
                  </span>
                </div>
                <button className="text-xs px-3 py-1 rounded border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  解除封鎖
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>你還沒有封鎖任何人</p>
        )}
      </div>
    </div>
  )
}
