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

interface GeneratorStats {
  lastHour: {
    count: number
    brands: { brand: string; count: number }[]
    articles: { brand: string; title_zh: string; created_at: string }[]
  }
  last24h: {
    count: number
    brands: { brand: string; count: number }[]
  }
  last3days: {
    count: number
    brands: { brand: string; count: number }[]
  }
  rawArticles: {
    count: number
    brands: { brand: string; count: number }[]
  }
  health: {
    status: 'healthy' | 'warning' | 'critical'
    teslaPercentage: number
    uniqueBrands: number
    brandsOverQuota: { brand: string; count: number }[]
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'confidence'>('date')
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 })

  // Generator stats
  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorStats, setGeneratorStats] = useState<GeneratorStats | null>(null)
  const [generatorLoading, setGeneratorLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)

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
        setLoading(false)
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

  const fetchGeneratorStats = async () => {
    setGeneratorLoading(true)
    try {
      const response = await fetch('/api/admin/generator-stats', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratorStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch generator stats:', error)
    } finally {
      setGeneratorLoading(false)
    }
  }

  const handleTriggerGenerator = async () => {
    if (!confirm('確定要手動觸發 Generator？這將開始生成新文章。')) {
      return
    }

    setTriggering(true)
    try {
      const response = await fetch('/api/admin/trigger-generator', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Generator 執行成功！\n生成: ${data.result.generated} 篇\n發布: ${data.result.published} 篇`)
        // 刷新統計
        fetchGeneratorStats()
        fetchArticles()
      } else {
        alert(`Generator 執行失敗：${data.error}`)
      }
    } catch (error) {
      alert('觸發失敗：' + (error instanceof Error ? error.message : '未知錯誤'))
    } finally {
      setTriggering(false)
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

        {/* Generator Monitor Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div
            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
            onClick={() => {
              setShowGenerator(!showGenerator)
              if (!showGenerator && !generatorStats) {
                fetchGeneratorStats()
              }
            }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Generator Monitor</h2>
              {generatorStats && (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  generatorStats.health.status === 'healthy' ? 'bg-green-100 text-green-800' :
                  generatorStats.health.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {generatorStats.health.status.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fetchGeneratorStats()
                }}
                disabled={generatorLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {generatorLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleTriggerGenerator()
                }}
                disabled={triggering}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {triggering ? 'Running...' : 'Trigger Generator'}
              </button>
              <span className="text-gray-400">{showGenerator ? '▼' : '▶'}</span>
            </div>
          </div>

          {showGenerator && generatorStats && (
            <div className="p-4 border-t space-y-6">
              {/* Health Status */}
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold mb-2">System Health</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Tesla %</div>
                    <div className={`text-xl font-bold ${
                      generatorStats.health.teslaPercentage > 80 ? 'text-red-600' :
                      generatorStats.health.teslaPercentage > 50 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {generatorStats.health.teslaPercentage.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Unique Brands</div>
                    <div className="text-xl font-bold">{generatorStats.health.uniqueBrands}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Over Quota</div>
                    <div className={`text-xl font-bold ${
                      generatorStats.health.brandsOverQuota.length > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {generatorStats.health.brandsOverQuota.length}
                    </div>
                  </div>
                </div>
                {generatorStats.health.brandsOverQuota.length > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    Brands over quota (3/hour): {generatorStats.health.brandsOverQuota.map(b => `${b.brand} (${b.count})`).join(', ')}
                  </div>
                )}
              </div>

              {/* Last Hour */}
              <div>
                <h3 className="font-semibold mb-2">Last Hour ({generatorStats.lastHour.count} articles)</h3>
                {generatorStats.lastHour.count > 0 ? (
                  <>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {generatorStats.lastHour.brands.slice(0, 8).map(b => (
                        <div key={b.brand} className="text-sm">
                          <span className={`font-medium ${b.count > 3 ? 'text-red-600' : 'text-gray-900'}`}>
                            {b.brand}
                          </span>: {b.count}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {generatorStats.lastHour.articles.map((a, i) => (
                        <div key={i}>[{a.brand}] {a.title_zh}</div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">No articles generated in the last hour</div>
                )}
              </div>

              {/* Last 24 Hours - Enhanced Brand Distribution */}
              <div className="bg-blue-50 p-4 rounded">
                <h3 className="font-semibold mb-3 text-lg">24小時品牌分布 ({generatorStats.last24h.count} 篇文章)</h3>

                {generatorStats.last24h.count > 0 ? (
                  <>
                    {/* Visual Progress Bars */}
                    <div className="space-y-2 mb-4">
                      {generatorStats.last24h.brands.slice(0, 10).map(b => {
                        const percentage = (b.count / generatorStats.last24h.count) * 100
                        const isOverweight = percentage > 25
                        const isWarning = percentage > 15 && percentage <= 25

                        return (
                          <div key={b.brand} className="flex items-center gap-2">
                            <div className="w-32 text-sm font-medium truncate">{b.brand}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isOverweight ? 'bg-red-500' :
                                  isWarning ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                                {b.count} 篇 ({percentage.toFixed(1)}%)
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Health Indicators */}
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-blue-200">
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">最高佔比</div>
                        <div className={`text-lg font-bold ${
                          (generatorStats.last24h.brands[0]?.count / generatorStats.last24h.count * 100) > 25 ? 'text-red-600' :
                          (generatorStats.last24h.brands[0]?.count / generatorStats.last24h.count * 100) > 15 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {generatorStats.last24h.brands[0]?.brand || 'N/A'}: {
                            ((generatorStats.last24h.brands[0]?.count / generatorStats.last24h.count * 100) || 0).toFixed(1)
                          }%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">品牌數量</div>
                        <div className="text-lg font-bold text-blue-600">
                          {generatorStats.health.uniqueBrands} 個品牌
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">健康狀態</div>
                        <div className={`text-lg font-bold ${
                          generatorStats.health.status === 'healthy' ? 'text-green-600' :
                          generatorStats.health.status === 'warning' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {generatorStats.health.status === 'healthy' ? '✅ 健康' :
                           generatorStats.health.status === 'warning' ? '⚠️  注意' :
                           '🔴 警告'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">過去 24 小時無文章生成</div>
                )}
              </div>

              {/* Raw Articles */}
              <div>
                <h3 className="font-semibold mb-2">Raw Articles ({generatorStats.rawArticles.count} pending)</h3>
                <div className="grid grid-cols-5 gap-2">
                  {generatorStats.rawArticles.brands.slice(0, 15).map(b => (
                    <div key={b.brand} className="text-sm">
                      <span className="font-medium">{b.brand}</span>: {b.count}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
