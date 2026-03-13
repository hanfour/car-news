'use client'

import { useEffect, useState, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

type ArticleFilter = 'all' | 'published' | 'draft'
type ArticleSortBy = 'date' | 'confidence'

interface Article {
  id: string
  title_zh: string
  content_zh: string
  cover_image: string | null
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

interface DuplicateMonitorStats {
  stats: {
    totalArticles: number
    articlesWithEmbedding: number
    semanticDuplicatesCount: number
    keywordDuplicatesCount: number
    brandViolationsCount: number
    publishedArticles: number
  }
  semanticDuplicates: Array<{
    article1: { id: string; title_zh: string; brand: string | null }
    article2: { id: string; title_zh: string; brand: string | null }
    similarity: number
  }>
  keywordDuplicates: Array<{
    article1: { id: string; title_zh: string; brand: string | null }
    article2: { id: string; title_zh: string; brand: string | null }
    overlap: number
    keywords: string[]
  }>
  brandViolations: Array<{
    brand: string
    count: number
    articles: Array<{ id: string; title_zh: string; created_at: string }>
  }>
}

interface SocialPost {
  id: string
  article_id: string
  platform: 'facebook' | 'instagram' | 'threads'
  content: string
  article_url: string
  status: 'pending' | 'posted' | 'failed'
  post_url: string | null
  error_message: string | null
  posted_at: string | null
  created_at: string
  article?: {
    id: string
    title_zh: string
    slug_en: string
    brand_tags: string[]
    created_at: string
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ArticleFilter>('all')
  const [sortBy, setSortBy] = useState<ArticleSortBy>('date')
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)

  // Generator stats
  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorStats, setGeneratorStats] = useState<GeneratorStats | null>(null)
  const [generatorLoading, setGeneratorLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)

  // Duplicate monitor
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [duplicateStats, setDuplicateStats] = useState<DuplicateMonitorStats | null>(null)
  const [duplicateLoading, setDuplicateLoading] = useState(false)

  // Social posts
  const [showSocialPosts, setShowSocialPosts] = useState(false)
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([])
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialFilter, setSocialFilter] = useState<{ status: string; platform: string }>({ status: '', platform: '' })
  const [socialPublishing, setSocialPublishing] = useState<string | null>(null)
  const [socialBatchPublishing, setSocialBatchPublishing] = useState(false)

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

  const fetchDuplicateStats = async () => {
    setDuplicateLoading(true)
    try {
      const response = await fetch('/api/admin/duplicate-monitor', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setDuplicateStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch duplicate stats:', error)
    } finally {
      setDuplicateLoading(false)
    }
  }

  const fetchSocialPosts = async (status?: string, platform?: string) => {
    setSocialLoading(true)
    try {
      const params = new URLSearchParams()
      const s = status ?? socialFilter.status
      const p = platform ?? socialFilter.platform
      if (s) params.set('status', s)
      if (p) params.set('platform', p)

      const response = await fetch(`/api/admin/social-posts?${params.toString()}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setSocialPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Failed to fetch social posts:', error)
    } finally {
      setSocialLoading(false)
    }
  }

  const handlePublishSocialPost = async (postId: string) => {
    setSocialPublishing(postId)
    try {
      const response = await fetch('/api/admin/social-posts/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      })

      const data = await response.json()
      if (data.success) {
        alert('發布成功！')
        fetchSocialPosts()
      } else {
        alert(`發布失敗：${data.error}`)
      }
    } catch (error) {
      alert('發布失敗')
    } finally {
      setSocialPublishing(null)
    }
  }

  const handleBatchPublishSocial = async () => {
    if (!confirm('確定要批量發布所有 pending 貼文？')) return

    setSocialBatchPublishing(true)
    try {
      const response = await fetch('/api/admin/social-posts/batch-publish', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()
      alert(`批量發布完成：${data.published} 成功，${data.failed} 失敗（共 ${data.total} 篇）`)
      fetchSocialPosts()
    } catch (error) {
      alert('批量發布失敗')
    } finally {
      setSocialBatchPublishing(false)
    }
  }

  const handleTriggerGenerator = async () => {
    if (!confirm('確定要手動觸發 Generator？這將開始生成新文章（目標 10 篇，約需 4-5 分鐘）。')) {
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
        // 新的異步響應：立即返回，不等待完成
        alert(`✅ Generator 已在後台啟動！\n\n${data.message}\n\n請稍後刷新頁面查看新文章。\n您可以關閉此頁面，生成會繼續進行。`)

        // 30 秒後自動刷新統計（讓用戶有時間看到第一批文章）
        setTimeout(() => {
          fetchGeneratorStats()
          fetchArticles()
        }, 30000)
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

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredArticles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)))
    }
  }

  const handleBatchPublish = async () => {
    if (selectedIds.size === 0) {
      alert('請先選擇文章')
      return
    }

    setBatchProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const id of selectedIds) {
      try {
        const response = await fetch(`/api/admin/articles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ published: true })
        })
        if (response.ok) successCount++
        else failCount++
      } catch (error) {
        failCount++
      }
    }

    setBatchProcessing(false)
    setSelectedIds(new Set())
    fetchArticles()
    alert(`批次發布完成！\n成功: ${successCount} 篇\n失敗: ${failCount} 篇`)
  }

  const handleBatchUnpublish = async () => {
    if (selectedIds.size === 0) {
      alert('請先選擇文章')
      return
    }

    setBatchProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const id of selectedIds) {
      try {
        const response = await fetch(`/api/admin/articles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ published: false })
        })
        if (response.ok) successCount++
        else failCount++
      } catch (error) {
        failCount++
      }
    }

    setBatchProcessing(false)
    setSelectedIds(new Set())
    fetchArticles()
    alert(`批次取消發布完成！\n成功: ${successCount} 篇\n失敗: ${failCount} 篇`)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      alert('請先選擇文章')
      return
    }

    if (!confirm(`確定要刪除 ${selectedIds.size} 篇文章嗎？此操作無法撤銷。`)) {
      return
    }

    setBatchProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const id of selectedIds) {
      try {
        const response = await fetch(`/api/admin/articles/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        if (response.ok) successCount++
        else failCount++
      } catch (error) {
        failCount++
      }
    }

    setBatchProcessing(false)
    setSelectedIds(new Set())
    fetchArticles()
    alert(`批次刪除完成！\n成功: ${successCount} 篇\n失敗: ${failCount} 篇`)
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

  const filteredArticles = sortedArticles.filter(article => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      article.id.toLowerCase().includes(term) ||
      article.title_zh.toLowerCase().includes(term) ||
      (article.primary_brand?.toLowerCase().includes(term) || false)
    )
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

        {/* Duplicate Monitor Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div
            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
            onClick={() => {
              setShowDuplicates(!showDuplicates)
              if (!showDuplicates && !duplicateStats) {
                fetchDuplicateStats()
              }
            }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Duplicate Monitor</h2>
              {duplicateStats && (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  duplicateStats.stats.semanticDuplicatesCount + duplicateStats.stats.keywordDuplicatesCount > 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {duplicateStats.stats.semanticDuplicatesCount + duplicateStats.stats.keywordDuplicatesCount > 0
                    ? `${duplicateStats.stats.semanticDuplicatesCount + duplicateStats.stats.keywordDuplicatesCount} ISSUES`
                    : 'CLEAN'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fetchDuplicateStats()
                }}
                disabled={duplicateLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {duplicateLoading ? 'Scanning...' : 'Scan Now'}
              </button>
              <span className="text-gray-400">{showDuplicates ? '▼' : '▶'}</span>
            </div>
          </div>

          {showDuplicates && duplicateStats && (
            <div className="p-4 border-t space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">分析文章</div>
                  <div className="text-xl font-bold text-blue-900">{duplicateStats.stats.totalArticles}</div>
                  <div className="text-xs text-gray-500">{duplicateStats.stats.articlesWithEmbedding} 含 embedding</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">語義重複</div>
                  <div className={`text-xl font-bold ${
                    duplicateStats.stats.semanticDuplicatesCount > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {duplicateStats.stats.semanticDuplicatesCount}
                  </div>
                  <div className="text-xs text-gray-500">&gt;90% 相似度</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">關鍵詞重複</div>
                  <div className={`text-xl font-bold ${
                    duplicateStats.stats.keywordDuplicatesCount > 0 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {duplicateStats.stats.keywordDuplicatesCount}
                  </div>
                  <div className="text-xs text-gray-500">&gt;70% 重疊</div>
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">品牌超限</div>
                  <div className={`text-xl font-bold ${
                    duplicateStats.stats.brandViolationsCount > 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {duplicateStats.stats.brandViolationsCount}
                  </div>
                  <div className="text-xs text-gray-500">&gt;3 篇/24h</div>
                </div>
              </div>

              {/* Semantic Duplicates */}
              {duplicateStats.semanticDuplicates.length > 0 && (
                <div className="bg-red-50 p-4 rounded">
                  <h3 className="font-semibold text-red-900 mb-3">🚨 語義重複 (Embedding Similarity &gt;90%)</h3>
                  <div className="space-y-3">
                    {duplicateStats.semanticDuplicates.map((dup, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-red-200">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-shrink-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                            {(dup.similarity * 100).toFixed(0)}%
                          </div>
                          <div className="flex-1 text-sm">
                            <div className="font-medium text-gray-900 mb-1">
                              [{dup.article1.brand}] {dup.article1.title_zh}
                            </div>
                            <div className="text-gray-700">
                              [{dup.article2.brand}] {dup.article2.title_zh}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => window.open(`/admin?search=${dup.article1.id}`, '_blank')}
                            className="text-blue-600 hover:underline"
                          >
                            查看 #{dup.article1.id}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => window.open(`/admin?search=${dup.article2.id}`, '_blank')}
                            className="text-blue-600 hover:underline"
                          >
                            查看 #{dup.article2.id}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyword Duplicates */}
              {duplicateStats.keywordDuplicates.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded">
                  <h3 className="font-semibold text-yellow-900 mb-3">⚠️ 關鍵詞重複 (Keyword Overlap &gt;70%)</h3>
                  <div className="space-y-3">
                    {duplicateStats.keywordDuplicates.map((dup, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-yellow-200">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-shrink-0 bg-yellow-600 text-white text-xs font-bold px-2 py-1 rounded">
                            {(dup.overlap * 100).toFixed(0)}%
                          </div>
                          <div className="flex-1 text-sm">
                            <div className="font-medium text-gray-900 mb-1">
                              [{dup.article1.brand}] {dup.article1.title_zh}
                            </div>
                            <div className="text-gray-700 mb-2">
                              [{dup.article2.brand}] {dup.article2.title_zh}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-gray-500">共同關鍵詞:</span>
                              {dup.keywords.map((kw, i) => (
                                <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => window.open(`/admin?search=${dup.article1.id}`, '_blank')}
                            className="text-blue-600 hover:underline"
                          >
                            查看 #{dup.article1.id}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => window.open(`/admin?search=${dup.article2.id}`, '_blank')}
                            className="text-blue-600 hover:underline"
                          >
                            查看 #{dup.article2.id}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Frequency Violations */}
              {duplicateStats.brandViolations.length > 0 && (
                <div className="bg-orange-50 p-4 rounded">
                  <h3 className="font-semibold text-orange-900 mb-3">📊 品牌頻率超限 (&gt;3 篇/24小時)</h3>
                  <div className="space-y-3">
                    {duplicateStats.brandViolations.map((vio, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-shrink-0 bg-orange-600 text-white text-sm font-bold px-3 py-1 rounded">
                            {vio.brand}
                          </div>
                          <div className="text-lg font-bold text-orange-600">{vio.count} 篇</div>
                          <div className="text-sm text-gray-500">(限制: 3 篇/24h)</div>
                        </div>
                        <div className="space-y-1 text-xs text-gray-700">
                          {vio.articles.map((article, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate flex-1">{article.title_zh}</span>
                              <button
                                onClick={() => window.open(`/admin?search=${article.id}`, '_blank')}
                                className="ml-2 text-blue-600 hover:underline flex-shrink-0"
                              >
                                #{article.id}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean State */}
              {duplicateStats.stats.semanticDuplicatesCount === 0 &&
               duplicateStats.stats.keywordDuplicatesCount === 0 &&
               duplicateStats.stats.brandViolationsCount === 0 && (
                <div className="bg-green-50 p-6 rounded text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-lg font-semibold text-green-900">無重複問題</div>
                  <div className="text-sm text-green-700 mt-1">
                    過去 7 天的 {duplicateStats.stats.totalArticles} 篇文章未發現重複內容
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Social Posts Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div
            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
            onClick={() => {
              setShowSocialPosts(!showSocialPosts)
              if (!showSocialPosts && socialPosts.length === 0) {
                fetchSocialPosts()
              }
            }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Social Posts</h2>
              {socialPosts.length > 0 && (
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {socialPosts.filter(p => p.status === 'pending').length} pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fetchSocialPosts()
                }}
                disabled={socialLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {socialLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleBatchPublishSocial()
                }}
                disabled={socialBatchPublishing || socialPosts.filter(p => p.status === 'pending').length === 0}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {socialBatchPublishing ? 'Publishing...' : 'Batch Publish'}
              </button>
              <span className="text-gray-400">{showSocialPosts ? '▼' : '▶'}</span>
            </div>
          </div>

          {showSocialPosts && (
            <div className="p-4 border-t space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">Pending</div>
                  <div className="text-xl font-bold text-yellow-600">
                    {socialPosts.filter(p => p.status === 'pending').length}
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">Posted</div>
                  <div className="text-xl font-bold text-green-600">
                    {socialPosts.filter(p => p.status === 'posted').length}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-xs text-gray-600 mb-1">Failed</div>
                  <div className="text-xl font-bold text-red-600">
                    {socialPosts.filter(p => p.status === 'failed').length}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-4">
                <div>
                  <label className="text-sm text-gray-600 mr-2">Status:</label>
                  <select
                    value={socialFilter.status}
                    onChange={(e) => {
                      const newFilter = { ...socialFilter, status: e.target.value }
                      setSocialFilter(newFilter)
                      fetchSocialPosts(e.target.value, socialFilter.platform)
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="posted">Posted</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 mr-2">Platform:</label>
                  <select
                    value={socialFilter.platform}
                    onChange={(e) => {
                      const newFilter = { ...socialFilter, platform: e.target.value }
                      setSocialFilter(newFilter)
                      fetchSocialPosts(socialFilter.status, e.target.value)
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="">All</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="threads">Threads</option>
                  </select>
                </div>
              </div>

              {/* Posts List */}
              {socialLoading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : socialPosts.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No social posts found</div>
              ) : (
                <div className="space-y-3">
                  {socialPosts.map((post) => (
                    <div key={post.id} className="border rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              post.platform === 'facebook' ? 'bg-blue-100 text-blue-800' :
                              post.platform === 'instagram' ? 'bg-pink-100 text-pink-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {post.platform === 'facebook' ? 'FB' :
                               post.platform === 'instagram' ? 'IG' : 'Threads'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              post.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              post.status === 'posted' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {post.status}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(post.created_at).toLocaleString('zh-TW')}
                            </span>
                          </div>
                          {post.article && (
                            <div className="text-sm font-medium text-gray-900 mb-1">
                              <a
                                href={`/${post.article.slug_en}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 hover:underline"
                              >
                                {post.article.title_zh}
                              </a>
                            </div>
                          )}
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {post.content}
                          </div>
                          {post.error_message && (
                            <div className="text-xs text-red-600 mt-1">
                              Error: {post.error_message}
                            </div>
                          )}
                          {post.post_url && (
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                            >
                              View post
                            </a>
                          )}
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          {post.status === 'pending' && (
                            <button
                              onClick={() => handlePublishSocialPost(post.id)}
                              disabled={socialPublishing === post.id}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {socialPublishing === post.id ? '...' : 'Publish'}
                            </button>
                          )}
                          {post.status === 'failed' && (
                            <button
                              onClick={() => handlePublishSocialPost(post.id)}
                              disabled={socialPublishing === post.id}
                              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                            >
                              {socialPublishing === post.id ? '...' : 'Retry'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-600 mr-2">Search:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, title, or brand..."
              className="border rounded px-3 py-1 w-full max-w-md"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mr-2">Filter:</label>
            <select
              value={filter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value as ArticleFilter)}
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
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as ArticleSortBy)}
              className="border rounded px-3 py-1"
            >
              <option value="date">Date</option>
              <option value="confidence">Confidence</option>
            </select>
          </div>
          <button
            onClick={fetchArticles}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Batch Operations */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow mb-4 flex items-center gap-4">
            <span className="text-sm font-medium text-blue-900">
              已選擇 {selectedIds.size} 篇文章
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBatchPublish}
                disabled={batchProcessing}
                className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {batchProcessing ? '處理中...' : '批次發布'}
              </button>
              <button
                onClick={handleBatchUnpublish}
                disabled={batchProcessing}
                className="px-4 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm"
              >
                {batchProcessing ? '處理中...' : '批次取消發布'}
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={batchProcessing}
                className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {batchProcessing ? '處理中...' : '批次刪除'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
              >
                取消選擇
              </button>
            </div>
          </div>
        )}

        {/* Articles Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredArticles.length && filteredArticles.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cover
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Article
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conf
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(article.id)}
                          onChange={() => toggleSelection(article.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {article.cover_image ? (
                          <img
                            src={article.cover_image}
                            alt=""
                            className="w-24 h-16 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-24 h-16 bg-gray-200 rounded border flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-lg">
                        <div className="space-y-1">
                          <div className="font-medium">
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
                              <span>{article.title_zh}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 line-clamp-2">
                            {article.content_zh?.slice(0, 120)}...
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            ID: {article.id}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {article.primary_brand || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {article.published_at || article.created_at.split('T')[0]}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          article.confidence >= 80 ? 'text-green-600' :
                          article.confidence >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {article.confidence}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          article.published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {article.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <a
                          href={`/admin/articles/${article.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </a>
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
