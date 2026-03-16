'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface InviteMemberModalProps {
  slug: string
  isOpen: boolean
  onClose: () => void
}

export function InviteMemberModal({ slug, isOpen, onClose }: InviteMemberModalProps) {
  const { session } = useAuth()
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token || !username.trim()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/clubs/${slug}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: username.trim(), message: message.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '邀請失敗')
        return
      }

      setSuccess(`已成功邀請 @${username.trim()}`)
      setUsername('')
      setMessage('')
      setTimeout(() => handleClose(), 1500)
    } catch {
      setError('系統錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setUsername('')
    setMessage('')
    setError('')
    setSuccess('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>邀請成員</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              使用者名稱
            </label>
            <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
              <span className="pl-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="輸入使用者名稱"
                className="flex-1 px-2 py-2 text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              附加訊息（選填）
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="歡迎加入我們的車友會！"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none focus:border-[var(--brand-primary)]"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              關閉
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-primary)', color: '#333' }}
            >
              {loading ? '邀請中...' : '送出邀請'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
