'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { RoleBadge } from './RoleBadge'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'

interface Member {
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: string
  joined_at: string
  profile?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

interface ClubMemberListProps {
  slug: string
  isOwner: boolean
  isAdmin: boolean
}

export function ClubMemberList({ slug, isOwner, isAdmin }: ClubMemberListProps) {
  const { session } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/clubs/${slug}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch { /* */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [slug])

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!session?.access_token) return
    try {
      const res = await fetch(`/api/clubs/${slug}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) fetchMembers()
    } catch { /* */ }
  }

  const handleKick = async (userId: string) => {
    if (!session?.access_token || !confirm('確定要移除此成員？')) return
    try {
      const res = await fetch(`/api/clubs/${slug}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status: 'kicked' }),
      })
      if (res.ok) fetchMembers()
    } catch { /* */ }
  }

  if (loading) return <LoadingCenter />

  // Group by role
  const owners = members.filter(m => m.role === 'owner')
  const admins = members.filter(m => m.role === 'admin')
  const regularMembers = members.filter(m => m.role === 'member')

  const renderGroup = (title: string, groupMembers: Member[]) => {
    if (groupMembers.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {title} — {groupMembers.length}
        </h3>
        <div className="space-y-1">
          {groupMembers.map(member => (
            <div key={member.user_id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
              <Link href={`/user/${member.profile?.username || member.user_id}`} className="flex items-center gap-3 min-w-0">
                <Avatar src={member.profile?.avatar_url} name={member.profile?.display_name} size={36} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {member.profile?.display_name || '匿名'}
                    </span>
                    <RoleBadge role={member.role} />
                  </div>
                  {member.profile?.username && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>@{member.profile.username}</span>
                  )}
                </div>
              </Link>

              {/* Management actions (owner/admin only, not on self or higher roles) */}
              {(isOwner || isAdmin) && member.role !== 'owner' && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isOwner && member.role !== 'admin' && (
                    <button
                      onClick={() => handleRoleChange(member.user_id, 'admin')}
                      className="text-xs px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      升為管理員
                    </button>
                  )}
                  {isOwner && member.role === 'admin' && (
                    <button
                      onClick={() => handleRoleChange(member.user_id, 'member')}
                      className="text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      取消管理員
                    </button>
                  )}
                  <button
                    onClick={() => handleKick(member.user_id)}
                    className="text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    style={{ color: 'var(--brand-red)' }}
                  >
                    移除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
      {renderGroup('創辦人', owners)}
      {renderGroup('管理員', admins)}
      {renderGroup('成員', regularMembers)}
      {members.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          還沒有任何成員
        </div>
      )}
    </div>
  )
}
