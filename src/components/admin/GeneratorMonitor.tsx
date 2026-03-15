'use client'

import { useState } from 'react'
import type { GeneratorStats } from '@/types/admin'
import { useToast } from '@/components/ToastContainer'

export function GeneratorMonitor() {
  const [expanded, setExpanded] = useState(false)
  const [stats, setStats] = useState<GeneratorStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const { showToast } = useToast()

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generator-stats', { credentials: 'include' })
      if (res.ok) setStats(await res.json())
    } catch {
      showToast('Failed to load generator stats', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      const res = await fetch('/api/admin/trigger-generator', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        showToast('Generator started in background!', 'success')
        setTimeout(fetchStats, 30000)
      } else {
        showToast(`Generator failed: ${data.error}`, 'error')
      }
    } catch {
      showToast('Failed to trigger generator', 'error')
    } finally {
      setTriggering(false)
    }
  }

  const toggle = () => {
    if (!expanded && !stats) fetchStats()
    setExpanded(!expanded)
  }

  return (
    <div id="generator" className="admin-card overflow-hidden">
      <div
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-900/50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <h2 className="text-base font-semibold text-white">Generator Monitor</h2>
          {stats && (
            <span className={
              stats.health.status === 'healthy' ? 'admin-badge-green' :
              stats.health.status === 'warning' ? 'admin-badge-yellow' : 'admin-badge-red'
            }>
              {stats.health.status.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchStats() }}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleTrigger() }}
            disabled={triggering}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-white disabled:opacity-50 transition-colors"
            style={{ background: 'var(--brand-primary)', color: '#1a1a1a' }}
          >
            {triggering ? 'Running...' : 'Trigger'}
          </button>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'chevron-open' : 'chevron-closed'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {expanded && stats && (
        <div className="p-4 border-t border-slate-800 space-y-5">
          {/* Health */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">System Health</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-400">Tesla %</div>
                <div className={`text-xl font-bold ${
                  stats.health.teslaPercentage > 80 ? 'text-red-400' :
                  stats.health.teslaPercentage > 50 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {stats.health.teslaPercentage.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Unique Brands</div>
                <div className="text-xl font-bold text-blue-400">{stats.health.uniqueBrands}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Over Quota</div>
                <div className={`text-xl font-bold ${stats.health.brandsOverQuota.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {stats.health.brandsOverQuota.length}
                </div>
              </div>
            </div>
            {stats.health.brandsOverQuota.length > 0 && (
              <div className="mt-2 text-xs text-red-400">
                Over quota: {stats.health.brandsOverQuota.map(b => `${b.brand} (${b.count})`).join(', ')}
              </div>
            )}
          </div>

          {/* Last Hour */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Last Hour ({stats.lastHour.count} articles)</h3>
            {stats.lastHour.count > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {stats.lastHour.brands.slice(0, 8).map(b => (
                    <div key={b.brand} className="text-xs text-slate-300">
                      <span className={`font-medium ${b.count > 3 ? 'text-red-400' : 'text-slate-200'}`}>{b.brand}</span>: {b.count}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {stats.lastHour.articles.map((a, i) => (
                    <div key={i}>[{a.brand}] {a.title_zh}</div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">No articles generated in the last hour</div>
            )}
          </div>

          {/* 24h Brand Distribution */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">24h Brand Distribution ({stats.last24h.count} articles)</h3>
            {stats.last24h.count > 0 ? (
              <div className="space-y-2">
                {stats.last24h.brands.slice(0, 10).map(b => {
                  const pct = (b.count / stats.last24h.count) * 100
                  return (
                    <div key={b.brand} className="flex items-center gap-2">
                      <div className="w-24 text-xs font-medium text-slate-300 truncate">{b.brand}</div>
                      <div className="flex-1 bg-slate-700 rounded-full h-5 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 25 ? 'bg-red-500' : pct > 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                          {b.count} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No data</div>
            )}
          </div>

          {/* Raw Articles */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Raw Articles ({stats.rawArticles.count} pending)</h3>
            <div className="grid grid-cols-5 gap-2">
              {stats.rawArticles.brands.slice(0, 15).map(b => (
                <div key={b.brand} className="text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{b.brand}</span>: {b.count}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
