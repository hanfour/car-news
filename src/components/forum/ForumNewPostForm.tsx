'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { MarkdownEditor } from '@/components/shared/MarkdownEditor'

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
}

export function ForumNewPostForm() {
  const router = useRouter()
  const { session } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    category_id: '',
    title: '',
    content: '',
    related_brand: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/forum/categories')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.categories)
        }
      } catch {
        // Silently fail
      }
    }
    fetchCategories()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return

    if (!form.category_id || !form.title.trim() || !form.content.trim()) {
      setError('請填寫所有必填欄位')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          related_brand: form.related_brand || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '發布失敗')
        return
      }

      router.push(`/community/post/${data.post.id}`)
    } catch {
      setError('系統錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 分類 */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          分類 *
        </label>
        <select
          value={form.category_id}
          onChange={(e) => setForm(prev => ({ ...prev, category_id: e.target.value }))}
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          required
        >
          <option value="">請選擇分類</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* 標題 */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          標題 *
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
          placeholder="請輸入標題"
          maxLength={200}
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          required
        />
      </div>

      {/* 相關品牌 */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          相關品牌（選填）
        </label>
        <input
          type="text"
          value={form.related_brand}
          onChange={(e) => setForm(prev => ({ ...prev, related_brand: e.target.value }))}
          placeholder="例：Toyota"
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* 內容 */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          內容 *
        </label>
        <MarkdownEditor
          value={form.content}
          onChange={(value) => setForm(prev => ({ ...prev, content: value }))}
          placeholder="分享你的想法..."
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--brand-red)' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full disabled:opacity-60"
      >
        {submitting ? '發布中...' : '發表貼文'}
      </button>
    </form>
  )
}
