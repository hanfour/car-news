'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface NotificationSettingsData {
  comment_reply: boolean
  comment_like: boolean
  new_follower: boolean
  followed_activity: boolean
  forum_reply: boolean
  car_club_post: boolean
}

const settingLabels: Record<keyof NotificationSettingsData, { label: string; description: string }> = {
  comment_reply: { label: '評論回覆', description: '有人回覆你的評論時通知' },
  comment_like: { label: '評論按讚', description: '有人對你的評論按讚時通知' },
  new_follower: { label: '新粉絲', description: '有人追蹤你時通知' },
  followed_activity: { label: '追蹤動態', description: '你追蹤的人有新活動時通知' },
  forum_reply: { label: '論壇回覆', description: '有人回覆你的論壇貼文時通知' },
  car_club_post: { label: '車友會貼文', description: '你的車友會有新貼文時通知' },
}

export default function NotificationSettingsPage() {
  const { session, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<NotificationSettingsData | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.access_token) return

      try {
        const res = await fetch('/api/notifications/settings', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setSettings(data.settings)
        }
      } catch (err) {
        console.error('[NotificationSettingsPage] fetchSettings:', err)
      }
    }
    fetchSettings()
  }, [session?.access_token])

  const handleToggle = async (key: keyof NotificationSettingsData) => {
    if (!session?.access_token || !settings) return

    const newValue = !settings[key]
    setSettings(prev => prev ? { ...prev, [key]: newValue } : null)
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ [key]: newValue }),
      })

      if (!res.ok) {
        setSettings(prev => prev ? { ...prev, [key]: !newValue } : null)
        setMessage('更新失敗')
      }
    } catch {
      setSettings(prev => prev ? { ...prev, [key]: !newValue } : null)
      setMessage('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/settings/profile" className="hover:text-[var(--brand-primary)] transition-colors">
            設定
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>通知偏好</span>
        </div>

        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            通知偏好設定
          </h1>

          {settings ? (
            <div className="space-y-4">
              {(Object.entries(settingLabels) as [keyof NotificationSettingsData, typeof settingLabels[keyof NotificationSettingsData]][]).map(
                ([key, { label, description }]) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: '#e5e5e5' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={saving}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings[key] ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings[key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
            </div>
          )}

          {message && (
            <p className="mt-4 text-sm" style={{ color: 'var(--brand-red)' }}>{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
