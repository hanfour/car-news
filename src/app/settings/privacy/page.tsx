'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [unblocking, setUnblocking] = useState<string | null>(null)

  useEffect(() => {
    setIsFavoritesPublic(profile?.is_favorites_public ?? true)
  }, [profile])

  const fetchBlocks = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch('/api/user/blocks', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBlockedUsers(data.blocks || [])
      }
    } catch (err) {
      console.error('[PrivacySettingsPage] fetchBlockedUsers:', err)
    } finally {
      setLoadingBlocks(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchBlocks()
  }, [fetchBlocks])

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
    } catch (err) { console.error('[PrivacySettingsPage] toggleFavoritesPublic:', err) } finally { setSaving(false) }
  }

  const handleUnblock = async (bu: BlockedUser) => {
    if (!session?.access_token) return
    const username = bu.profile?.username || bu.blocked_id
    setUnblocking(bu.blocked_id)
    try {
      const res = await fetch(`/api/user/${username}/block`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setBlockedUsers(prev => prev.filter(b => b.blocked_id !== bu.blocked_id))
      }
    } catch (err) {
      console.error('[PrivacySettingsPage] handleUnblock:', err)
    } finally {
      setUnblocking(null)
    }
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
                    {bu.profile?.display_name || bu.profile?.username || '匿名'}
                  </span>
                </div>
                <button
                  onClick={() => handleUnblock(bu)}
                  disabled={unblocking === bu.blocked_id}
                  className="text-xs px-3 py-1 rounded border hover:bg-gray-50 transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {unblocking === bu.blocked_id ? '...' : '解除封鎖'}
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
