'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Article, ArticleFilter, ArticleSortBy, DashboardStats } from '@/types/admin'
import { useToast } from '@/components/ToastContainer'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { StatsCards } from '@/components/admin/StatsCards'
import { ArticlesTable } from '@/components/admin/ArticlesTable'
import { BatchActionBar } from '@/components/admin/BatchActionBar'
import { GeneratorMonitor } from '@/components/admin/GeneratorMonitor'
import { DuplicateMonitor } from '@/components/admin/DuplicateMonitor'
import { SocialPostsPanel } from '@/components/admin/SocialPostsPanel'

export default function AdminDashboard() {
  const router = useRouter()
  const { showToast } = useToast()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ArticleFilter>('all')
  const [sortBy, setSortBy] = useState<ArticleSortBy>('date')
  const [stats, setStats] = useState<DashboardStats>({ total: 0, published: 0, draft: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; variant: 'danger' | 'default'; onConfirm: () => void
  }>({ open: false, title: '', message: '', variant: 'default', onConfirm: () => {} })

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/admin/articles?limit=100'
      if (filter === 'published') url += '&published=true'
      if (filter === 'draft') url += '&published=false'

      const res = await fetch(url, { credentials: 'include' })
      if (res.status === 401) { router.push('/admin/login'); return }

      const data = await res.json()
      setArticles(data.articles || [])
      const total = data.total || 0
      const published = data.articles?.filter((a: Article) => a.published).length || 0
      setStats({ total, published, draft: total - published })
    } catch {
      showToast('Failed to load articles', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, router, showToast])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ published: !currentStatus })
      })
      if (res.ok) {
        showToast(currentStatus ? 'Unpublished' : 'Published', 'success')
        fetchArticles()
      }
    } catch {
      showToast('Failed to update article', 'error')
    }
  }

  const handleDelete = (id: string, title: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Article',
      message: `Are you sure you want to delete "${title}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE', credentials: 'include' })
          if (res.ok) {
            showToast('Article deleted', 'success')
            fetchArticles()
          }
        } catch {
          showToast('Failed to delete article', 'error')
        }
      }
    })
  }

  const filteredArticles = articles.filter(a => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return a.id.toLowerCase().includes(term) || a.title_zh.toLowerCase().includes(term) || (a.primary_brand?.toLowerCase().includes(term) || false)
  })

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    newSet.has(id) ? newSet.delete(id) : newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredArticles.length ? new Set() : new Set(filteredArticles.map(a => a.id)))
  }

  const batchAction = async (action: 'publish' | 'unpublish' | 'delete') => {
    if (action === 'delete') {
      setConfirmDialog({
        open: true,
        title: 'Batch Delete',
        message: `Delete ${selectedIds.size} articles? This cannot be undone.`,
        variant: 'danger',
        onConfirm: () => {
          setConfirmDialog(d => ({ ...d, open: false }))
          executeBatch('delete')
        }
      })
      return
    }
    executeBatch(action)
  }

  const executeBatch = async (action: 'publish' | 'unpublish' | 'delete') => {
    setBatchProcessing(true)

    const results = await Promise.allSettled(
      Array.from(selectedIds).map(id =>
        action === 'delete'
          ? fetch(`/api/admin/articles/${id}`, { method: 'DELETE', credentials: 'include' })
          : fetch(`/api/admin/articles/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ published: action === 'publish' })
            })
      )
    )

    const success = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
    const fail = results.length - success

    setBatchProcessing(false)
    setSelectedIds(new Set())
    fetchArticles()
    showToast(`Batch ${action}: ${success} success, ${fail} failed`, fail > 0 ? 'warning' : 'success')
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <span className="text-xs text-slate-500">
          {new Date().toLocaleDateString('zh-TW')}
        </span>
      </div>

      <StatsCards stats={stats} loading={loading} />

      {/* Monitor panels */}
      <div className="space-y-4">
        <div id="generator"><GeneratorMonitor /></div>
        <div id="duplicates"><DuplicateMonitor /></div>
        <div id="social"><SocialPostsPanel /></div>
      </div>

      {/* Articles */}
      <div id="articles" />
      <ArticlesTable
        articles={articles}
        loading={loading}
        filter={filter}
        sortBy={sortBy}
        searchTerm={searchTerm}
        selectedIds={selectedIds}
        onFilterChange={setFilter}
        onSortChange={setSortBy}
        onSearchChange={setSearchTerm}
        onToggleSelection={toggleSelection}
        onToggleSelectAll={toggleSelectAll}
        onTogglePublish={handleTogglePublish}
        onDelete={handleDelete}
        onRefresh={fetchArticles}
      />

      <BatchActionBar
        selectedCount={selectedIds.size}
        processing={batchProcessing}
        onPublish={() => batchAction('publish')}
        onUnpublish={() => batchAction('unpublish')}
        onDelete={() => batchAction('delete')}
        onClear={() => setSelectedIds(new Set())}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  )
}
