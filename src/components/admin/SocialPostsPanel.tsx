'use client'

import { useState } from 'react'
import type { SocialPost } from '@/types/admin'
import { useToast } from '@/components/ToastContainer'

export function SocialPostsPanel() {
  const [expanded, setExpanded] = useState(false)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({ status: '', platform: '' })
  const [publishing, setPublishing] = useState<string | null>(null)
  const [batchPublishing, setBatchPublishing] = useState(false)
  const { showToast } = useToast()

  const fetchPosts = async (status?: string, platform?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const s = status ?? filter.status
      const p = platform ?? filter.platform
      if (s) params.set('status', s)
      if (p) params.set('platform', p)

      const res = await fetch(`/api/admin/social-posts?${params.toString()}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch {
      showToast('Failed to load social posts', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (postId: string) => {
    setPublishing(postId)
    try {
      const res = await fetch('/api/admin/social-posts/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Published successfully!', 'success')
        fetchPosts()
      } else {
        showToast(`Publish failed: ${data.error}`, 'error')
      }
    } catch {
      showToast('Publish failed', 'error')
    } finally {
      setPublishing(null)
    }
  }

  const handleBatchPublish = async () => {
    setBatchPublishing(true)
    try {
      const res = await fetch('/api/admin/social-posts/batch-publish', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      showToast(`Batch: ${data.published} published, ${data.failed} failed`, data.failed > 0 ? 'warning' : 'success')
      fetchPosts()
    } catch {
      showToast('Batch publish failed', 'error')
    } finally {
      setBatchPublishing(false)
    }
  }

  const toggle = () => {
    if (!expanded && posts.length === 0) fetchPosts()
    setExpanded(!expanded)
  }

  const pendingCount = posts.filter(p => p.status === 'pending').length

  return (
    <div id="social" className="admin-card overflow-hidden">
      <div
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-900/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
          </svg>
          <h2 className="text-base font-semibold text-white">Social Posts</h2>
          {posts.length > 0 && pendingCount > 0 && (
            <span className="admin-badge-blue">{pendingCount} pending</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchPosts() }}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleBatchPublish() }}
            disabled={batchPublishing || pendingCount === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {batchPublishing ? 'Publishing...' : 'Batch Publish'}
          </button>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'chevron-open' : 'chevron-closed'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-slate-800 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pending', count: posts.filter(p => p.status === 'pending').length, color: 'text-yellow-400' },
              { label: 'Posted', count: posts.filter(p => p.status === 'posted').length, color: 'text-green-400' },
              { label: 'Failed', count: posts.filter(p => p.status === 'failed').length, color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={filter.status}
              onChange={(e) => {
                const newFilter = { ...filter, status: e.target.value }
                setFilter(newFilter)
                fetchPosts(e.target.value, filter.platform)
              }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="posted">Posted</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filter.platform}
              onChange={(e) => {
                const newFilter = { ...filter, platform: e.target.value }
                setFilter(newFilter)
                fetchPosts(filter.status, e.target.value)
              }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
            >
              <option value="">All Platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="threads">Threads</option>
            </select>
          </div>

          {/* Posts list */}
          {loading ? (
            <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">No posts found</div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <div key={post.id} className="bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={
                          post.platform === 'facebook' ? 'admin-badge-blue' :
                          post.platform === 'instagram' ? 'admin-badge' + ' bg-pink-500/15 text-pink-400' :
                          'admin-badge bg-slate-600/30 text-slate-300'
                        }>
                          {post.platform === 'facebook' ? 'FB' : post.platform === 'instagram' ? 'IG' : 'Threads'}
                        </span>
                        <span className={
                          post.status === 'pending' ? 'admin-badge-yellow' :
                          post.status === 'posted' ? 'admin-badge-green' : 'admin-badge-red'
                        }>
                          {post.status}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(post.created_at).toLocaleString('zh-TW')}
                        </span>
                      </div>
                      {post.article && (
                        <div className="text-xs font-medium text-white mb-1">{post.article.title_zh}</div>
                      )}
                      <div className="text-xs text-slate-400 line-clamp-2">{post.content}</div>
                      {post.error_message && (
                        <div className="text-[10px] text-red-400 mt-1">Error: {post.error_message}</div>
                      )}
                      {post.post_url && (
                        <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline mt-1 inline-block">
                          View post
                        </a>
                      )}
                    </div>
                    {(post.status === 'pending' || post.status === 'failed') && (
                      <button
                        onClick={() => handlePublish(post.id)}
                        disabled={publishing === post.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {publishing === post.id ? '...' : post.status === 'failed' ? 'Retry' : 'Publish'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
