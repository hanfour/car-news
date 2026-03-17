'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ToastContainer'
import { ImageUploader } from '@/components/shared/ImageUploader'

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
    cover_image?: string | null
    images?: string[]
  }
}

export function CarForm({ initialData }: CarFormProps) {
  const router = useRouter()
  const { session } = useAuth()
  const { showToast } = useToast()
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
  const [coverImage, setCoverImage] = useState<string | null>(initialData?.cover_image || null)
  const [galleryImages, setGalleryImages] = useState<string[]>(initialData?.images || [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageUpload = async (file: File, type: 'cover' | 'gallery'): Promise<string> => {
    if (!session?.access_token || !initialData?.id) throw new Error('未登入或車輛未儲存')

    const formData = new FormData()
    formData.append('image', file)
    formData.append('type', type)

    const res = await fetch(`/api/garage/${initialData.id}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '上傳失敗')

    if (type === 'cover') {
      setCoverImage(data.url)
    } else {
      setGalleryImages(prev => [...prev, data.url])
    }

    showToast('圖片上傳成功', 'success')
    return data.url
  }

  const handleImageDelete = async (url: string, type: 'cover' | 'gallery') => {
    if (!session?.access_token || !initialData?.id) return

    try {
      const res = await fetch(`/api/garage/${initialData.id}/images`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url, type }),
      })

      if (res.ok) {
        if (type === 'cover') {
          setCoverImage(null)
        } else {
          setGalleryImages(prev => prev.filter(img => img !== url))
        }
        showToast('圖片已刪除', 'success')
      }
    } catch (err) {
      console.error('[CarForm] Delete image failed:', err)
      showToast('刪除失敗', 'error')
    }
  }

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

      {/* 圖片上傳區（僅編輯模式） */}
      {isEditing ? (
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>封面照片</label>
            <div className="flex items-start gap-3">
              <ImageUploader
                onUpload={(file) => handleImageUpload(file, 'cover')}
                currentImage={coverImage || undefined}
                className="flex-1"
              />
              {coverImage && (
                <button
                  type="button"
                  onClick={() => handleImageDelete(coverImage, 'cover')}
                  className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  移除
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              相簿（最多 {10} 張，已上傳 {galleryImages.length} 張）
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {galleryImages.map((img) => (
                <div key={img} className="relative group aspect-square rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="相簿圖片" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleImageDelete(img, 'gallery')}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {galleryImages.length < 10 && (
                <ImageUploader
                  onUpload={(file) => handleImageUpload(file, 'gallery')}
                  className="aspect-square"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          儲存後可新增照片
        </p>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--brand-red)' }}>{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
        {submitting ? '儲存中...' : isEditing ? '更新愛車' : '新增愛車'}
      </button>
    </form>
  )
}
