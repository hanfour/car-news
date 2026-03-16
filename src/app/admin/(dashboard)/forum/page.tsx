'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ForumPost {
  id: string
  title: string
  content: string
  is_pinned: boolean
  is_locked: boolean
  is_approved: boolean
  reply_count: number
  view_count: number
  created_at: string
  author?: { username?: string; display_name?: string }
  category?: { name: string; icon?: string }
}

type FilterType = 'all' | 'pending' | 'pinned' | 'locked'

export default function AdminForumPage() {
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', filter })
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/admin/forum/posts?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
        setTotalPages(data.totalPages || 0)
        setTotal(data.total || 0)
      }
    } catch { /* */ } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, filter])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleAction = async (postId: string, updates: Record<string, boolean>) => {
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/admin/forum/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const { post } = await res.json()
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...post } : p))
      }
    } catch { /* */ } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('確定要刪除此貼文？此操作無法撤銷。')) return
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/admin/forum/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId))
        setTotal(prev => prev - 1)
      }
    } catch { /* */ } finally {
      setActionLoading(null)
    }
  }

  const handleBatchAction = async (updates: Record<string, boolean>) => {
    if (selected.size === 0) return
    setActionLoading('batch')
    try {
      const results = await Promise.allSettled(
        Array.from(selected).map(id =>
          fetch(`/api/admin/forum/posts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates),
          }).then(res => {
            if (!res.ok) throw new Error(`Failed for ${id}`)
            return res
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) {
        alert(`${results.length - failed} 項成功，${failed} 項失敗`)
      }
      setSelected(new Set())
      fetchPosts()
    } catch { /* */ } finally {
      setActionLoading(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === posts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(posts.map(p => p.id)))
    }
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待審核' },
    { key: 'pinned', label: '已置頂' },
    { key: 'locked', label: '已鎖定' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">論壇管理</h1>

      {/* 搜尋 + 篩選 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="搜尋貼文..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (page !== 1) setPage(1) }}
          className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 text-sm placeholder-slate-500 outline-none focus:border-[var(--brand-primary)]"
        />
        <div className="flex gap-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1) }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[var(--brand-primary)] text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 批次操作 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-slate-800 rounded-lg">
          <span className="text-sm text-slate-300">已選 {selected.size} 項</span>
          <button
            onClick={() => handleBatchAction({ is_approved: true })}
            disabled={actionLoading === 'batch'}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            批次核准
          </button>
          <button
            onClick={() => handleBatchAction({ is_pinned: true })}
            disabled={actionLoading === 'batch'}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            批次置頂
          </button>
          <button
            onClick={() => handleBatchAction({ is_locked: true })}
            disabled={actionLoading === 'batch'}
            className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            批次鎖定
          </button>
        </div>
      )}

      {/* 總數 */}
      <div className="text-xs text-slate-500 mb-3">共 {total} 篇貼文</div>

      {/* 表格 */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">沒有找到貼文</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="p-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === posts.length && posts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left">貼文</th>
                <th className="p-3 text-left hidden md:table-cell">分類</th>
                <th className="p-3 text-left hidden lg:table-cell">作者</th>
                <th className="p-3 text-center hidden sm:table-cell">狀態</th>
                <th className="p-3 text-center hidden sm:table-cell">回覆</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-white truncate max-w-[300px]">{post.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(post.created_at).toLocaleDateString('zh-TW')}
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-slate-400">
                    {post.category ? `${post.category.icon || ''} ${post.category.name}` : '-'}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-slate-400">
                    {post.author?.display_name || post.author?.username || '-'}
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {post.is_pinned && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">置頂</span>}
                      {post.is_locked && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">鎖定</span>}
                      {!post.is_approved && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">待審</span>}
                      {post.is_approved && !post.is_pinned && !post.is_locked && <span className="text-xs text-slate-600">-</span>}
                    </div>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell text-slate-400">{post.reply_count}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {!post.is_approved && (
                        <button
                          onClick={() => handleAction(post.id, { is_approved: true })}
                          disabled={actionLoading === post.id}
                          className="p-1.5 rounded hover:bg-green-500/20 text-green-400 disabled:opacity-50"
                          title="核准"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(post.id, { is_pinned: !post.is_pinned })}
                        disabled={actionLoading === post.id}
                        className={`p-1.5 rounded hover:bg-blue-500/20 disabled:opacity-50 ${post.is_pinned ? 'text-blue-400' : 'text-slate-500'}`}
                        title={post.is_pinned ? '取消置頂' : '置頂'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleAction(post.id, { is_locked: !post.is_locked })}
                        disabled={actionLoading === post.id}
                        className={`p-1.5 rounded hover:bg-orange-500/20 disabled:opacity-50 ${post.is_locked ? 'text-orange-400' : 'text-slate-500'}`}
                        title={post.is_locked ? '解鎖' : '鎖定'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {post.is_locked ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={actionLoading === post.id}
                        className="p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 disabled:opacity-50"
                        title="刪除"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-white disabled:opacity-30"
          >
            上一頁
          </button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-white disabled:opacity-30"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  )
}
