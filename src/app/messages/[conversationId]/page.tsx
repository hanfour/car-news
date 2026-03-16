'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/shared/Avatar'
import { MessageBubble } from '@/components/messages/MessageBubble'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_deleted: boolean
  created_at: string
  sender?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

interface Participant {
  user_id: string
  is_self: boolean
  profile?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.conversationId as string
  const { user, session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialLoadDone = useRef(false)

  const otherParticipant = participants.find(p => !p.is_self)

  const fetchMessages = useCallback(async (before?: string) => {
    if (!session?.access_token) return
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (before) params.set('before', before)

      const res = await fetch(`/api/messages/conversations/${conversationId}/messages?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (before) {
          setMessages(prev => [...(data.messages || []), ...prev])
        } else {
          setMessages(data.messages || [])
        }
        setHasMore(data.has_more || false)
      }
    } catch { /* */ }
  }, [session?.access_token, conversationId])

  // Initial load
  useEffect(() => {
    if (!session?.access_token) return

    const loadConversation = async () => {
      try {
        // Fetch conversation details + messages in parallel
        const [detailRes] = await Promise.all([
          fetch(`/api/messages/conversations/${conversationId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetchMessages(),
        ])

        if (detailRes.ok) {
          const detailData = await detailRes.json()
          setParticipants(detailData.participants || [])
        } else {
          router.push('/messages')
        }

        // Mark as read
        fetch(`/api/messages/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      } catch { /* */ } finally {
        setLoading(false)
        initialLoadDone.current = true
      }
    }

    loadConversation()
  }, [session?.access_token, conversationId, fetchMessages, router])

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (initialLoadDone.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Polling for new messages every 10 seconds (append only, preserve history)
  useEffect(() => {
    if (!session?.access_token) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages/conversations/${conversationId}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const newMessages: Message[] = data.messages || []
          setMessages(prev => {
            // If we have loaded history (more than latest 50), merge new messages
            if (prev.length > 50) {
              const existingIds = new Set(prev.map(m => m.id))
              const toAppend = newMessages.filter(m => !existingIds.has(m.id))
              return toAppend.length > 0 ? [...prev, ...toAppend] : prev
            }
            // Otherwise safe to replace with latest
            return newMessages
          })
        }
        // Mark as read
        fetch(`/api/messages/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      } catch { /* */ }
    }, 10000)
    return () => clearInterval(interval)
  }, [session?.access_token, conversationId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token || !newMessage.trim() || sending) return

    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')

    try {
      const res = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        const { message } = await res.json()
        const myProfile = participants.find(p => p.is_self)?.profile
        setMessages(prev => [...prev, {
          ...message,
          sender: myProfile || { id: user!.id },
        }])
      } else {
        setNewMessage(content) // Restore on failure
      }
    } catch {
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p style={{ color: 'var(--text-secondary)' }}>請先登入</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/messages" className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          {otherParticipant?.profile && (
            <Link href={`/user/${otherParticipant.profile.username || otherParticipant.user_id}`} className="flex items-center gap-2">
              <Avatar
                src={otherParticipant.profile.avatar_url}
                name={otherParticipant.profile.display_name}
                size={32}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {otherParticipant.profile.display_name || otherParticipant.profile.username || '用戶'}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {hasMore && (
                <button
                  onClick={() => {
                    const oldest = messages[0]
                    if (oldest) fetchMessages(oldest.created_at)
                  }}
                  className="w-full py-2 text-xs text-center hover:underline mb-4"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  載入更早的訊息
                </button>
              )}

              {messages.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                  <p className="text-sm">開始你們的對話吧</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isSelf={msg.sender_id === user.id}
                    />
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="輸入訊息..."
            className="flex-1 px-4 py-2.5 text-sm border rounded-full outline-none focus:border-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)' }}
            maxLength={5000}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="p-2.5 rounded-full disabled:opacity-30 transition-colors"
            style={{ backgroundColor: 'var(--brand-primary)', color: '#333' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
