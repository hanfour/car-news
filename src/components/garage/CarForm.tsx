'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface CarFormProps {
  initialData?: {
    id?: string
    brand: string
    model: string
    year?: number
    trim_level?: string
    color?: string
    nickname?: string
    description?: string
    purchase_date?: string
    mileage?: number
    is_public?: boolean
  }
}

export function CarForm({ initialData }: CarFormProps) {
  const router = useRouter()
  const { session } = useAuth()
  const isEditing = !!initialData?.id

  const [form, setForm] = useState({
    brand: initialData?.brand || '',
    model: initialData?.model || '',
    year: initialData?.year?.toString() || '',
    trim_level: initialData?.trim_level || '',
    color: initialData?.color || '',
    nickname: initialData?.nickname || '',
    description: initialData?.description || '',
    purchase_date: initialData?.purchase_date || '',
    mileage: initialData?.mileage?.toString() || '',
    is_public: initialData?.is_public !== false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return

    setSubmitting(true)
    setError(null)

    try {
      const url = isEditing ? `/api/garage/${initialData!.id}` : '/api/garage'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          year: form.year ? parseInt(form.year) : null,
          mileage: form.mileage ? parseInt(form.mileage) : null,
          purchase_date: form.purchase_date || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '操作失敗')
        return
      }

      router.push('/garage/my')
    } catch {
      setError('系統錯誤')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>品牌 *</label>
          <input type="text" value={form.brand} onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))} required
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="例：Toyota" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>車型 *</label>
          <input type="text" value={form.model} onChange={(e) => setForm(prev => ({ ...prev, model: e.target.value }))} required
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="例：Corolla Cross" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>年份</label>
          <input type="number" value={form.year} onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))} min="1900" max="2030"
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>顏色</label>
          <input type="text" value={form.color} onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="例：珍珠白" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>暱稱</label>
        <input type="text" value={form.nickname} onChange={(e) => setForm(prev => ({ ...prev, nickname: e.target.value }))}
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="給你的愛車取個名字" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>描述</label>
        <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
          className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="分享你與愛車的故事..." />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>型號等級</label>
          <input type="text" value={form.trim_level} onChange={(e) => setForm(prev => ({ ...prev, trim_level: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="例：旗艦版" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>里程數 (km)</label>
          <input type="number" value={form.mileage} onChange={(e) => setForm(prev => ({ ...prev, mileage: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_public" checked={form.is_public}
          onChange={(e) => setForm(prev => ({ ...prev, is_public: e.target.checked }))}
          className="w-4 h-4 accent-[var(--brand-primary)]" />
        <label htmlFor="is_public" className="text-sm" style={{ color: 'var(--text-primary)' }}>
          公開展示在愛車牆
        </label>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--brand-red)' }}>{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
        {submitting ? '儲存中...' : isEditing ? '更新愛車' : '新增愛車'}
      </button>
    </form>
  )
}
