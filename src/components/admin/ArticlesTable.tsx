'use client'

import { ChangeEvent } from 'react'
import type { Article, ArticleFilter, ArticleSortBy } from '@/types/admin'
import { TableSkeleton } from './Skeleton'

interface ArticlesTableProps {
  articles: Article[]
  loading: boolean
  filter: ArticleFilter
  sortBy: ArticleSortBy
  searchTerm: string
  selectedIds: Set<string>
  onFilterChange: (filter: ArticleFilter) => void
  onSortChange: (sort: ArticleSortBy) => void
  onSearchChange: (term: string) => void
  onToggleSelection: (id: string) => void
  onToggleSelectAll: () => void
  onTogglePublish: (id: string, currentStatus: boolean) => void
  onDelete: (id: string, title: string) => void
  onRefresh: () => void
}

const filterOptions: { value: ArticleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
]

export function ArticlesTable({
  articles,
  loading,
  filter,
  sortBy,
  searchTerm,
  selectedIds,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onToggleSelection,
  onToggleSelectAll,
  onTogglePublish,
  onDelete,
  onRefresh,
}: ArticlesTableProps) {
  const sorted = [...articles].sort((a, b) => {
    if (sortBy === 'confidence') return b.confidence - a.confidence
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const filtered = sorted.filter((article) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      article.id.toLowerCase().includes(term) ||
      article.title_zh.toLowerCase().includes(term) ||
      (article.primary_brand?.toLowerCase().includes(term) || false)
    )
  })

  return (
    <div id="articles" className="admin-card overflow-hidden">
      {/* Controls bar */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Articles</h2>
            {/* Segment control */}
            <div className="admin-segment">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onFilterChange(opt.value)}
                  className={filter === opt.value ? 'admin-segment-btn-active' : 'admin-segment-btn'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search ID, title, brand..."
                className="w-full sm:w-64 pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => onSortChange(e.target.value as ArticleSortBy)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            >
              <option value="date">Date</option>
              <option value="confidence">Confidence</option>
            </select>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500">No articles found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={onToggleSelectAll}
                    className="rounded border-slate-600 bg-slate-800"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Cover</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Article</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Conf</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr key={article.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(article.id)}
                      onChange={() => onToggleSelection(article.id)}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {article.cover_image ? (
                      <img src={article.cover_image} alt={article.title_zh || '文章封面'} className="w-20 h-14 object-cover rounded-lg border border-slate-700" />
                    ) : (
                      <div className="w-20 h-14 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center text-slate-600 text-xs">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-white">
                        {article.published && article.published_at ? (
                          <a
                            href={`/${article.published_at.split('T')[0].slice(0, 7).replace(/-/g, '/')}/${article.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--brand-primary)] transition-colors"
                          >
                            {article.title_zh}
                          </a>
                        ) : (
                          article.title_zh
                        )}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1">{article.content_zh?.slice(0, 80)}...</div>
                      <div className="text-xs text-slate-600 font-mono">{article.id}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                    {article.primary_brand || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                    {(article.published_at || article.created_at).split('T')[0]}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${
                      article.confidence >= 80 ? 'text-green-400' :
                      article.confidence >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {article.confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={article.published ? 'admin-badge-green' : 'admin-badge-yellow'}>
                      {article.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/admin/articles/${article.id}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </a>
                      <button
                        onClick={() => onTogglePublish(article.id, article.published)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          article.published
                            ? 'text-yellow-400 hover:bg-yellow-400/10'
                            : 'text-green-400 hover:bg-green-400/10'
                        }`}
                        title={article.published ? 'Unpublish' : 'Publish'}
                      >
                        {article.published ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => onDelete(article.id, article.title_zh)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
