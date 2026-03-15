'use client'

import { useState } from 'react'
import type { DuplicateMonitorStats } from '@/types/admin'
import { useToast } from '@/components/ToastContainer'

export function DuplicateMonitor() {
  const [expanded, setExpanded] = useState(false)
  const [stats, setStats] = useState<DuplicateMonitorStats | null>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/duplicate-monitor', { credentials: 'include' })
      if (res.ok) setStats(await res.json())
    } catch {
      showToast('Failed to load duplicate stats', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    if (!expanded && !stats) fetchStats()
    setExpanded(!expanded)
  }

  const issueCount = stats
    ? stats.stats.semanticDuplicatesCount + stats.stats.keywordDuplicatesCount
    : 0

  return (
    <div id="duplicates" className="admin-card overflow-hidden">
      <div
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-900/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
          <h2 className="text-base font-semibold text-white">Duplicate Monitor</h2>
          {stats && (
            <span className={issueCount > 0 ? 'admin-badge-red' : 'admin-badge-green'}>
              {issueCount > 0 ? `${issueCount} ISSUES` : 'CLEAN'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchStats() }}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Scanning...' : 'Scan Now'}
          </button>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'chevron-open' : 'chevron-closed'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {expanded && stats && (
        <div className="p-4 border-t border-slate-800 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Analyzed', value: stats.stats.totalArticles, sub: `${stats.stats.articlesWithEmbedding} with embedding`, color: 'text-blue-400' },
              { label: 'Semantic', value: stats.stats.semanticDuplicatesCount, sub: '>90% similarity', color: stats.stats.semanticDuplicatesCount > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Keyword', value: stats.stats.keywordDuplicatesCount, sub: '>70% overlap', color: stats.stats.keywordDuplicatesCount > 0 ? 'text-yellow-400' : 'text-green-400' },
              { label: 'Brand Limit', value: stats.stats.brandViolationsCount, sub: '>3/24h', color: stats.stats.brandViolationsCount > 0 ? 'text-orange-400' : 'text-green-400' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">{item.label}</div>
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-slate-500">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Semantic Duplicates */}
          {stats.semanticDuplicates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-400">Semantic Duplicates</h3>
              {stats.semanticDuplicates.map((dup, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-red-900/30">
                  <div className="flex items-start gap-2">
                    <span className="admin-badge-red flex-shrink-0">{(dup.similarity * 100).toFixed(0)}%</span>
                    <div className="text-xs space-y-1 flex-1 min-w-0">
                      <div className="text-slate-200">[{dup.article1.brand}] {dup.article1.title_zh}</div>
                      <div className="text-slate-400">[{dup.article2.brand}] {dup.article2.title_zh}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Keyword Duplicates */}
          {stats.keywordDuplicates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-yellow-400">Keyword Duplicates</h3>
              {stats.keywordDuplicates.map((dup, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-yellow-900/30">
                  <div className="flex items-start gap-2">
                    <span className="admin-badge-yellow flex-shrink-0">{(dup.overlap * 100).toFixed(0)}%</span>
                    <div className="text-xs space-y-1 flex-1 min-w-0">
                      <div className="text-slate-200">[{dup.article1.brand}] {dup.article1.title_zh}</div>
                      <div className="text-slate-400">[{dup.article2.brand}] {dup.article2.title_zh}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dup.keywords.map((kw, i) => (
                          <span key={i} className="admin-badge-yellow">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Brand Violations */}
          {stats.brandViolations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-orange-400">Brand Violations (&gt;3/24h)</h3>
              {stats.brandViolations.map((vio, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-orange-900/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="admin-badge" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}>{vio.brand}</span>
                    <span className="text-sm font-bold text-orange-400">{vio.count} articles</span>
                  </div>
                  <div className="space-y-0.5">
                    {vio.articles.map((a, i) => (
                      <div key={i} className="text-xs text-slate-400 flex justify-between">
                        <span className="truncate flex-1">{a.title_zh}</span>
                        <a href={`/admin/articles/${a.id}`} className="text-blue-400 hover:underline ml-2 flex-shrink-0">#{a.id}</a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clean state */}
          {issueCount === 0 && stats.stats.brandViolationsCount === 0 && (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">&#10003;</div>
              <div className="text-sm font-semibold text-green-400">No duplicate issues</div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.stats.totalArticles} articles analyzed (last 7 days)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
