'use client'

import { useState, useEffect, ChangeEvent } from 'react'

type StatusFilter = 'all' | 'pending' | 'posted' | 'failed'

interface SocialPost {
  id: string
  article_id: string
  platform: 'facebook' | 'instagram' | 'threads'
  content: string
  article_url: string
  status: 'pending' | 'approved' | 'posted' | 'failed'
  posted_at: string | null
  post_url: string | null
  error_message: string | null
  created_at: string
  article: {
    id: string
    title: string
    slug: string
    brand_tags: string[]
    created_at: string
  }
}

const PLATFORM_ICONS = {
  facebook: '📘',
  instagram: '📷',
  threads: '🧵'
}

const PLATFORM_COLORS = {
  facebook: 'bg-blue-100 text-blue-800 border-blue-200',
  instagram: 'bg-pink-100 text-pink-800 border-pink-200',
  threads: 'bg-purple-100 text-purple-800 border-purple-200'
}

export default function SocialMediaManager() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/social-posts', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Failed to fetch social posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (postId: string, platform: string) => {
    if (!confirm(`確定要發布到 ${platform.toUpperCase()}？`)) {
      return
    }

    setPublishing(postId)
    try {
      const response = await fetch('/api/admin/social-posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ postId })
      })

      const data = await response.json()

      if (data.success) {
        alert(`成功發布到 ${platform}！\n${data.postUrl || ''}`)
        fetchPosts() // 刷新列表
      } else {
        alert(`發布失敗：${data.error}`)
      }
    } catch (error) {
      alert('發布失敗：' + (error instanceof Error ? error.message : '未知錯誤'))
    } finally {
      setPublishing(null)
    }
  }

  const filteredPosts = posts.filter(post => {
    if (statusFilter === 'all') return true
    return post.status === statusFilter
  })

  const stats = {
    total: posts.length,
    pending: posts.filter(p => p.status === 'pending').length,
    posted: posts.filter(p => p.status === 'posted').length,
    failed: posts.filter(p => p.status === 'failed').length
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">社群媒體發文管理</h2>
          <button
            onClick={fetchPosts}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">Posted</div>
            <div className="text-2xl font-bold text-green-600">{stats.posted}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">Failed</div>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="p-4 border-b bg-gray-50">
        <label className="text-sm text-gray-600 mr-2">Status:</label>
        <select
          value={statusFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as StatusFilter)}
          className="border rounded px-3 py-1"
        >
          <option value="all">All ({stats.total})</option>
          <option value="pending">Pending ({stats.pending})</option>
          <option value="posted">Posted ({stats.posted})</option>
          <option value="failed">Failed ({stats.failed})</option>
        </select>
      </div>

      {/* Posts List */}
      <div className="divide-y max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            {statusFilter === 'pending' ? '無待審核貼文' : '沒有符合條件的貼文'}
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start gap-4">
                {/* Left: Content */}
                <div className="flex-1 min-w-0">
                  {/* Platform Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${PLATFORM_COLORS[post.platform]}`}>
                      {PLATFORM_ICONS[post.platform]} {post.platform.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      post.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      post.status === 'posted' ? 'bg-green-100 text-green-800' :
                      post.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {post.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleString('zh-TW')}
                    </span>
                  </div>

                  {/* Article Title */}
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    文章：
                    <a
                      href={post.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline ml-1"
                    >
                      {post.article.title}
                    </a>
                  </div>

                  {/* Post Content */}
                  <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200 mb-2">
                    {post.content}
                  </div>

                  {/* Posted Info or Error */}
                  {post.posted_at && post.post_url && (
                    <div className="text-xs text-green-600">
                      ✅ 已發布於 {new Date(post.posted_at).toLocaleString('zh-TW')} -{' '}
                      <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="underline">
                        查看貼文
                      </a>
                    </div>
                  )}

                  {post.error_message && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      ❌ 錯誤：{post.error_message}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  {post.status === 'pending' && (
                    <button
                      onClick={() => handlePublish(post.id, post.platform)}
                      disabled={publishing === post.id}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {publishing === post.id ? 'Publishing...' : '✓ Approve & Publish'}
                    </button>
                  )}

                  {post.status === 'failed' && (
                    <button
                      onClick={() => handlePublish(post.id, post.platform)}
                      disabled={publishing === post.id}
                      className="px-4 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {publishing === post.id ? 'Retrying...' : '🔄 Retry'}
                    </button>
                  )}

                  {post.status === 'posted' && post.post_url && (
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 text-center whitespace-nowrap"
                    >
                      🔗 View Post
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - How to Create Posts */}
      {stats.total === 0 && !loading && (
        <div className="p-4 bg-blue-50 border-t text-sm text-gray-700">
          <p className="font-semibold mb-1">如何創建社群貼文？</p>
          <p className="text-xs">
            使用 API：POST /api/admin/social-posts 並提供 articleId 和 platforms 參數。<br/>
            詳細說明請參考：docs/social-media-setup.md
          </p>
        </div>
      )}
    </div>
  )
}
