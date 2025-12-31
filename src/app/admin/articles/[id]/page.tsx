'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

interface Article {
  id: string
  title_zh: string
  content_zh: string
  slug_en: string
  published: boolean
  published_at: string | null
  created_at: string
  confidence: number
  primary_brand: string | null
  brands: string[] | null
  categories: string[] | null
  tags: string[] | null
  cover_image: string | null
  image_credit: string | null
  source_urls: string[] | null
}

export default function ArticleEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    fetchArticle()
  }, [id])

  const fetchArticle = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        credentials: 'include'
      })

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch article')
      }

      const data = await response.json()
      setArticle(data.article)
      setTitle(data.article.title_zh)
      setContent(data.article.content_zh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title_zh: title,
          content_zh: content
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save article')
      }

      setSuccess('文章已儲存！')
      fetchArticle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateImage = async () => {
    if (!confirm('確定要重新生成封面圖嗎？這將使用 DALL-E 3 生成新圖片（約 $0.04）。')) {
      return
    }

    setRegeneratingImage(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/articles/${id}/regenerate-image`, {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to regenerate image')
      }

      setSuccess('封面圖已重新生成！')
      fetchArticle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate image')
    } finally {
      setRegeneratingImage(false)
    }
  }

  const handlePublish = async () => {
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ published: !article?.published })
      })

      if (response.ok) {
        fetchArticle()
        setSuccess(article?.published ? '已取消發布' : '已發布！')
      }
    } catch (err) {
      setError('Failed to update publish status')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Article not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← 返回列表
            </button>
            <h1 className="text-xl font-bold text-gray-900">編輯文章</h1>
            <span className="text-sm text-gray-500 font-mono">{id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              article.published
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {article.published ? '已發布' : '草稿'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content - Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                標題
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                內容 (Markdown)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={25}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '儲存中...' : '儲存變更'}
              </button>
              <button
                onClick={handlePublish}
                className={`px-6 py-2 rounded-lg ${
                  article.published
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {article.published ? '取消發布' : '發布文章'}
              </button>
            </div>
          </div>

          {/* Sidebar - Right column */}
          <div className="space-y-6">
            {/* Cover Image */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">封面圖片</h3>
              {article.cover_image ? (
                <div className="space-y-4">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={article.cover_image}
                      alt={article.title_zh}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {article.image_credit || '來源未標示'}
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                  無封面圖
                </div>
              )}
              <button
                onClick={handleRegenerateImage}
                disabled={regeneratingImage}
                className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {regeneratingImage ? '生成中...' : '🎨 重新生成 AI 圖片'}
              </button>
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">文章資訊</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">品牌</span>
                  <span className="font-medium">{article.primary_brand || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">信心度</span>
                  <span className={`font-medium ${
                    article.confidence >= 80 ? 'text-green-600' :
                    article.confidence >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {article.confidence}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">建立時間</span>
                  <span className="font-medium">{article.created_at.split('T')[0]}</span>
                </div>
                {article.published_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">發布時間</span>
                    <span className="font-medium">{article.published_at.split('T')[0]}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Categories & Tags */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">分類與標籤</h3>
              {article.categories && article.categories.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">分類</div>
                  <div className="flex flex-wrap gap-1">
                    {article.categories.map((cat, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {article.tags && article.tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">標籤</div>
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sources */}
            {article.source_urls && article.source_urls.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">來源連結</h3>
                <div className="space-y-2 text-xs">
                  {article.source_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-600 hover:underline truncate"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
