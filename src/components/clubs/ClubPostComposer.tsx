'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/shared/Avatar'
import { MarkdownEditor } from '@/components/shared/MarkdownEditor'

interface ClubPostComposerProps {
  slug: string
  onPostCreated: () => void
}

export function ClubPostComposer({ slug, onPostCreated }: ClubPostComposerProps) {
  const { user, profile, session } = useAuth()
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (!session) return null

  const handlePost = async () => {
    if (!session?.access_token || !content.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/clubs/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setContent('')
        setExpanded(false)
        onPostCreated()
      }
    } catch { /* */ } finally {
      setPosting(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 bg-white rounded-xl border p-4 transition-colors hover:border-[var(--brand-primary)] text-left"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <Avatar src={profile?.avatar_url} name={profile?.display_name || user?.email} size={36} />
        <div className="flex-1 text-sm rounded-lg px-4 py-2.5 bg-gray-50" style={{ color: 'var(--text-tertiary)' }}>
          分享你的想法...
        </div>
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
      <MarkdownEditor value={content} onChange={setContent} placeholder="分享你的想法..." rows={3} maxLength={5000} />
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={() => { setExpanded(false); setContent('') }}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          取消
        </button>
        <button onClick={handlePost} disabled={posting || !content.trim()} className="btn-primary text-sm disabled:opacity-60">
          {posting ? '發布中...' : '發表'}
        </button>
      </div>
    </div>
  )
}
