'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/shared/Avatar'

interface Conversation {
  id: string
  last_message_at: string | null
  last_message_preview: string | null
  other_participants: Array<{
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  }>
  has_unread: boolean
  is_muted: boolean
}

export default function MessagesPage() {
  const { user, session } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.access_token) return
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/messages/conversations', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setConversations(data.conversations || [])
        }
      } catch (err) { console.error('[MessagesPage] fetchConversations:', err) } finally {
        setLoading(false)
      }
    }
    fetchConversations()

    // Polling every 15 seconds
    const interval = setInterval(fetchConversations, 15000)
    return () => clearInterval(interval)
  }, [session?.access_token])

  const handleNewConversation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token || !newUsername.trim()) return

    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: newUsername.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '建立對話失敗')
        return
      }

      setNewUsername('')
      router.push(`/messages/${data.conversation_id}`)
    } catch {
      setError('系統錯誤')
    } finally {
      setCreating(false)
    }
  }

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '剛剛'
    if (minutes < 60) return `${minutes}分鐘前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小時前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}天前`
    return new Date(dateStr).toLocaleDateString('zh-TW')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p style={{ color: 'var(--text-secondary)' }}>請先登入</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>私訊</h1>

        {/* 新對話 */}
        <form onSubmit={handleNewConversation} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
              <span className="pl-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>@</span>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="輸入使用者名稱開始對話"
                className="flex-1 px-2 py-2.5 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newUsername.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--brand-primary)', color: '#333' }}
            >
              {creating ? '...' : '開始對話'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </form>

        {/* 對話列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
            <p className="text-sm">還沒有任何對話</p>
            <p className="text-xs mt-1">輸入使用者名稱開始你的第一個對話</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map(conv => {
              const other = conv.other_participants[0]
              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50 ${
                    conv.has_unread ? 'bg-[var(--brand-primary-lighter)]' : ''
                  }`}
                >
                  <Avatar
                    src={other?.avatar_url}
                    name={other?.display_name}
                    size={44}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${conv.has_unread ? 'font-bold' : 'font-medium'}`} style={{ color: 'var(--text-primary)' }}>
                        {other?.display_name || other?.username || '未知用戶'}
                      </span>
                      <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--text-tertiary)' }}>
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    {conv.last_message_preview && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {conv.last_message_preview}
                      </p>
                    )}
                  </div>
                  {conv.has_unread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-primary)] flex-shrink-0" />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
