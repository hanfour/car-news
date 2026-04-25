'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { RoleBadge } from './RoleBadge'
import { InviteMemberModal } from './InviteMemberModal'
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

export function ClubMemberList({ slug, isOwner, isAdmin: isAdminProp }: ClubMemberListProps) {
  const { session, user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${slug}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch (err) { console.error('[ClubMemberList] fetchMembers:', err) } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Auto-detect admin role from fetched members data (avoids extra API call from parent)
  const myRole = user ? members.find(m => m.user_id === user.id)?.role : undefined
  const isAdmin = isAdminProp || myRole === 'admin'

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!session?.access_token) return
    try {
      const res = await fetch(`/api/clubs/${slug}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) fetchMembers()
    } catch (err) { console.error('[ClubMemberList] handleRoleChange:', err) }
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
    } catch (err) { console.error('[ClubMemberList] handleKick:', err) }
  }

  const handleTransferOwnership = async (newOwnerId: string, displayName: string) => {
    if (!session?.access_token) return
    // 雙重確認：第一段先警告後果，第二段要使用者輸入接管人名以避免誤觸
    if (!confirm(
      `確定要將社團轉讓給「${displayName}」？\n\n` +
      `轉讓後：\n` +
      `• 你會被自動降為管理員（admin）\n` +
      `• 接管人成為新創辦人，擁有解散與轉讓權限\n` +
      `• 此操作無法在前端撤銷（需新 owner 再次轉讓回來）\n\n` +
      `確定繼續？`
    )) return
    const confirmInput = prompt(`再次確認：請輸入接管人名稱「${displayName}」`)
    if (confirmInput?.trim() !== displayName) {
      alert('接管人名稱不符，已取消轉讓')
      return
    }
    try {
      const res = await fetch(`/api/clubs/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ newOwnerId }),
      })
      if (res.ok) {
        alert('已轉讓社團，重新整理後生效')
        // 刷新狀態 — 原 owner 已降為 admin
        fetchMembers()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || '轉讓失敗')
      }
    } catch (err) { console.error('[ClubMemberList] handleTransferOwnership:', err) }
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
                    <>
                      <button
                        onClick={() => handleRoleChange(member.user_id, 'member')}
                        className="text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        取消管理員
                      </button>
                      <button
                        onClick={() => handleTransferOwnership(
                          member.user_id,
                          member.profile?.display_name || member.profile?.username || '匿名'
                        )}
                        className="text-xs px-2 py-1 rounded hover:bg-amber-50 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        title="將整個社團轉讓給此管理員"
                      >
                        轉讓社團
                      </button>
                    </>
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
      {(isOwner || isAdmin) && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--brand-primary)', color: '#333' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            邀請成員
          </button>
        </div>
      )}
      {renderGroup('創辦人', owners)}
      {renderGroup('管理員', admins)}
      {renderGroup('成員', regularMembers)}
      {members.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          還沒有任何成員
        </div>
      )}
      <InviteMemberModal slug={slug} isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} />
    </div>
  )
}
