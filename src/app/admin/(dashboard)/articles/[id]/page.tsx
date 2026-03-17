'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import type { Article } from '@/types/admin'
import { useToast } from '@/components/ToastContainer'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

export default function ArticleEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageCredit, setImageCredit] = useState('Source: Web')
  const [generationMethod, setGenerationMethod] = useState<'auto' | 'flux-dev' | 'flux-schnell' | 'dalle' | 'flux-img2img'>('auto')

  const [auditData, setAuditData] = useState<{
    composite_score: number
    scores: Record<string, number>
  } | null>(null)

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  const fetchArticle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { credentials: 'include' })
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error('Failed to fetch article')

      const data = await res.json()
      setArticle(data.article)
      setTitle(data.article.title_zh)
      setContent(data.article.content_zh)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, router, showToast])

  useEffect(() => { fetchArticle() }, [fetchArticle])

  // Fetch audit data
  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/images/audit/${id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (data.audit) setAuditData(data.audit) })
      .catch(() => {})
  }, [id])

  // Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title_zh: title, content_zh: content })
      })
      if (!res.ok) throw new Error('Failed to save')
      showToast('Saved!', 'success')
      fetchArticle()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateImage = () => {
    const costMap: Record<string, string> = { 'auto': '~$0.008', 'flux-dev': '$0.008', 'flux-schnell': '$0.003', 'dalle': '$0.040', 'flux-img2img': '$0.025' }
    const methodName: Record<string, string> = { 'auto': 'Auto', 'flux-dev': 'Flux Dev', 'flux-schnell': 'Flux Schnell', 'dalle': 'DALL-E 3', 'flux-img2img': 'Img2Img 合成' }

    setConfirmDialog({
      open: true,
      title: 'Regenerate Image',
      message: `Use ${methodName[generationMethod]} to regenerate cover image? Estimated cost: ${costMap[generationMethod]}`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        setRegeneratingImage(true)
        try {
          const res = await fetch(`/api/admin/articles/${id}/regenerate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ method: generationMethod })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Failed')
          showToast(`Image regenerated with ${data.provider}. Cost: $${data.cost?.toFixed(3) || '?'}`, 'success')
          fetchArticle()
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed', 'error')
        } finally {
          setRegeneratingImage(false)
        }
      }
    })
  }

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ published: !article?.published })
      })
      if (res.ok) {
        showToast(article?.published ? 'Unpublished' : 'Published!', 'success')
        fetchArticle()
      }
    } catch {
      showToast('Failed to update', 'error')
    }
  }

  const handleUploadImage = async () => {
    if (!selectedFile) { showToast('Please select an image', 'warning'); return }
    if (!imageCredit.trim()) { showToast('Please enter image credit', 'warning'); return }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('imageCredit', imageCredit.trim())

      const res = await fetch(`/api/admin/articles/${id}/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      showToast('Image uploaded with watermark!', 'success')
      setSelectedFile(null)
      fetchArticle()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) {
      setSelectedFile(file)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-96 w-full" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-20">
        <div className="text-red-400 text-lg">Article not found</div>
        <button onClick={() => router.push('/admin')} className="mt-4 text-sm text-blue-400 hover:underline">
          Back to Dashboard
        </button>
      </div>
    )
  }

  const hasImages = article.images && (article.images as Array<unknown>).length > 0

  const genMethods = [
    { value: 'auto' as const, label: 'Auto', desc: 'Flux first', cost: '~$0.008' },
    { value: 'flux-dev' as const, label: 'Flux Dev', desc: 'Balanced', cost: '$0.008' },
    { value: 'flux-schnell' as const, label: 'Flux Schnell', desc: 'Fast', cost: '$0.003' },
    { value: 'dalle' as const, label: 'DALL-E 3', desc: 'High quality', cost: '$0.040' },
    ...(hasImages ? [{ value: 'flux-img2img' as const, label: 'Img2Img 合成', desc: 'Reference based', cost: '$0.025' }] : []),
  ]

  return (
    <div className="space-y-6 pb-10">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="text-sm text-slate-500">
              <span className="hover:text-slate-300 cursor-pointer" onClick={() => router.push('/admin')}>Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-white">Edit Article</span>
            </div>
            <span className={article.published ? 'admin-badge-green' : 'admin-badge-yellow'}>
              {article.published ? 'Published' : 'Draft'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePublish}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                article.published
                  ? 'bg-yellow-600 text-white hover:bg-yellow-500'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {article.published ? 'Unpublish' : 'Publish'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: 'var(--brand-primary)', color: '#1a1a1a' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title */}
          <div className="admin-card p-4">
            <label className="block text-xs font-medium text-slate-400 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          {/* Content */}
          <div className="admin-card p-4">
            <label className="block text-xs font-medium text-slate-400 mb-2">Content (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={25}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-y"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Cover Image */}
          <div className="admin-card p-4">
            <h3 className="text-xs font-medium text-slate-400 mb-3">Cover Image</h3>
            {article.cover_image ? (
              <div className="space-y-2">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-800">
                  <Image src={article.cover_image} alt={article.title_zh} fill className="object-cover" />
                </div>
                <div className="text-[10px] text-slate-500">{article.image_credit || 'No credit'}</div>
              </div>
            ) : (
              <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center text-slate-600 text-sm">
                No cover image
              </div>
            )}

            {/* Upload */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-medium text-slate-400 mb-2">Upload Image</h4>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-slate-500 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="text-xs text-slate-300">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</div>
                ) : (
                  <div className="text-xs text-slate-500">Drag & drop or click to select</div>
                )}
              </div>
              <input
                type="text"
                value={imageCredit}
                onChange={(e) => setImageCredit(e.target.value)}
                placeholder="Image source (English only)"
                className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
              <button
                onClick={handleUploadImage}
                disabled={uploadingImage || !selectedFile}
                className="w-full mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {uploadingImage ? 'Uploading...' : 'Upload with Watermark'}
              </button>
            </div>

            {/* AI Generation */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-medium text-slate-400 mb-2">AI Generate</h4>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {genMethods.map((m) => (
                  <label
                    key={m.value}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-[11px] border transition-colors ${
                      generationMethod === m.value
                        ? 'border-[var(--brand-primary)] bg-slate-800 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="genMethod"
                      value={m.value}
                      checked={generationMethod === m.value}
                      onChange={() => setGenerationMethod(m.value)}
                      className="sr-only"
                    />
                    <div>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-[10px] text-slate-500">{m.cost}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={handleRegenerateImage}
                disabled={regeneratingImage}
                className="w-full px-4 py-2 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
              >
                {regeneratingImage ? 'Generating...' : 'Regenerate AI Image'}
              </button>
            </div>
          </div>

          {/* Image Quality Audit */}
          {auditData && (
            <div className="admin-card p-4">
              <h3 className="text-xs font-medium text-slate-400 mb-3">Image Quality</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-2xl font-bold ${
                  auditData.composite_score >= 7.0 ? 'text-green-400' : auditData.composite_score >= 5.0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {auditData.composite_score}
                </span>
                <span className="text-xs text-slate-500">/ 10</span>
                {auditData.composite_score < 7.0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300">Recommend Regeneration</span>
                )}
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    { key: 'vehicleAccuracy', label: 'Vehicle', weight: '30%' },
                    { key: 'detailFidelity', label: 'Detail', weight: '20%' },
                    { key: 'composition', label: 'Composition', weight: '15%' },
                    { key: 'mood', label: 'Mood', weight: '10%' },
                    { key: 'technicalQuality', label: 'Technical', weight: '15%' },
                    { key: 'editorialFit', label: 'Editorial', weight: '10%' },
                  ] as const
                ).map(({ key, label, weight }) => {
                  const score = auditData.scores[key] ?? 0
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">{label} <span className="text-slate-600">({weight})</span></span>
                        <span className={score < 7.0 ? 'text-red-400' : 'text-slate-300'}>{score}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            score >= 7.0 ? 'bg-green-500' : score >= 5.0 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(score * 10, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="admin-card p-4">
            <h3 className="text-xs font-medium text-slate-400 mb-3">Article Info</h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Brand', value: article.primary_brand || '-' },
                {
                  label: 'Confidence',
                  value: `${article.confidence}%`,
                  color: article.confidence >= 80 ? 'text-green-400' : article.confidence >= 60 ? 'text-yellow-400' : 'text-red-400'
                },
                { label: 'Created', value: article.created_at.split('T')[0] },
                ...(article.published_at ? [{ label: 'Published', value: article.published_at.split('T')[0] }] : []),
                { label: 'ID', value: article.id, mono: true },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-slate-500">{item.label}</span>
                  <span className={`font-medium ${(item as { color?: string }).color || 'text-slate-200'} ${(item as { mono?: boolean }).mono ? 'font-mono text-xs' : ''}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Categories & Tags */}
          {((article.categories && article.categories.length > 0) || (article.tags && article.tags.length > 0)) && (
            <div className="admin-card p-4">
              <h3 className="text-xs font-medium text-slate-400 mb-3">Categories & Tags</h3>
              {article.categories && article.categories.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] text-slate-500 mb-1">Categories</div>
                  <div className="flex flex-wrap gap-1">
                    {article.categories.map((cat, i) => (
                      <span key={i} className="admin-badge-blue">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
              {article.tags && article.tags.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag, i) => (
                      <span key={i} className="admin-badge bg-slate-700/50 text-slate-300">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sources */}
          {article.source_urls && article.source_urls.length > 0 && (
            <div className="admin-card p-4">
              <h3 className="text-xs font-medium text-slate-400 mb-3">Sources</h3>
              <div className="space-y-1.5">
                {article.source_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-blue-400 hover:underline truncate">
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  )
}
