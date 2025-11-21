'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Article {
  id: string
  title_zh: string
  published: boolean
  published_at: string | null
  created_at: string
  confidence: number
  primary_brand: string | null
  view_count: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'confidence'>('date')
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 })

  useEffect(() => {
    fetchArticles()
  }, [filter])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      let url = '/api/admin/articles?limit=100'
      if (filter === 'published') url += '&published=true'
      if (filter === 'draft') url += '&published=false'

      const response = await fetch(url, {
        credentials: 'include'
      })

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      const data = await response.json()
      setArticles(data.articles || [])

      // 計算統計
      const total = data.total || 0
      const published = data.articles?.filter((a: Article) => a.published).length || 0
      setStats({ total, published, draft: total - published })
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ published: !currentStatus })
      })

      if (response.ok) {
        fetchArticles()
      }
    } catch (error) {
      console.error('Failed to update article:', error)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除文章「${title}」嗎？此操作無法撤銷。`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        fetchArticles()
      }
    } catch (error) {
      console.error('Failed to delete article:', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    // Add logout param to tell login page to clear browser-side Supabase session
    router.push('/admin/login?logout=1')
    router.refresh()
  }

  const sortedArticles = [...articles].sort((a, b) => {
    if (sortBy === 'confidence') {
      return b.confidence - a.confidence
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Articles</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Published</div>
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Draft</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4">
          <div>
            <label className="text-sm text-gray-600 mr-2">Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="border rounded px-3 py-1"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mr-2">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded px-3 py-1"
            >
              <option value="date">Date</option>
              <option value="confidence">Confidence</option>
            </select>
          </div>
          <button
            onClick={fetchArticles}
            className="ml-auto px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Articles Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conf
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {article.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                        {article.published && article.published_at ? (
                          <a
                            href={`/${article.published_at.split('T')[0].slice(0, 7).replace(/-/g, '/')}/${article.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline"
                          >
                            {article.title_zh}
                          </a>
                        ) : (
                          <span className="text-gray-600">{article.title_zh}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {article.primary_brand || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {article.published_at || article.created_at.split('T')[0]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          article.confidence >= 80 ? 'text-green-600' :
                          article.confidence >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {article.confidence}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {article.view_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          article.published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {article.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleTogglePublish(article.id, article.published)}
                          className={`${
                            article.published
                              ? 'text-yellow-600 hover:text-yellow-900'
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {article.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleDelete(article.id, article.title_zh)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && articles.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            No articles found
          </div>
        )}
      </main>
    </div>
  )
}
