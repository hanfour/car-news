'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { EmptyState } from '@/components/shared/EmptyState'

export default function CreateClubPage() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const [form, setForm] = useState({ name: '', slug: '', description: '', brand: '', model: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, brand: form.brand || null, model: form.model || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '建立失敗'); return }
      router.push(`/clubs/${data.club.slug}`)
    } catch { setError('系統錯誤') } finally { setSubmitting(false) }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
    </div>
  }

  if (!session) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <EmptyState title="請先登入" />
    </div>
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/clubs" className="hover:text-[var(--brand-primary)] transition-colors">車友會</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>建立車友會</span>
        </div>

        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>建立車友會</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>名稱 *</label>
              <input type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} required
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="例：Toyota 車友俱樂部" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>網址代碼 *</label>
              <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>小寫字母、數字和連字號，3-50 字元</p>
              <input type="text" value={form.slug} onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} required
                pattern="^[a-z0-9-]{3,50}$"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="例：toyota-tw" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>描述</label>
              <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>品牌</label>
                <input type="text" value={form.brand} onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>車型</label>
                <input type="text" value={form.model} onChange={(e) => setForm(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            {error && <p className="text-sm" style={{ color: 'var(--brand-red)' }}>{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
              {submitting ? '建立中...' : '建立車友會'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
