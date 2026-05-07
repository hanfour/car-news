'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useUsageStats, type UsageDayBucket, type UsageWindow } from '@/hooks/useUsageStats'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'

// 統一各 provider 顏色（Recharts 兩張圖共用）
const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  claude: '#D97757',
  openai: '#10A37F',
  fal: '#7C3AED',
}

// purpose 在 pie chart 用的色盤（與 provider 不衝突）
const PURPOSE_COLORS = ['#60a5fa', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#f87171']

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

interface SummaryCardProps {
  title: string
  window: UsageWindow
}

function SummaryCard({ title, window }: SummaryCardProps) {
  const providers = Object.entries(window.byProvider).sort((a, b) => b[1].cost - a[1].cost)

  return (
    <div className="admin-card p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">{title}</div>
      <div className="flex items-baseline gap-3 mb-3">
        <div className="text-2xl font-bold text-white">{formatNumber(window.calls)}</div>
        <div className="text-xs text-slate-500">calls</div>
      </div>
      <div className="text-lg font-mono text-emerald-400 mb-3">{formatCost(window.cost)}</div>
      {providers.length > 0 ? (
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          {providers.map(([provider, stats]) => (
            <div key={provider} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: PROVIDER_COLORS[provider] || '#94a3b8' }}
                />
                <span className="text-slate-300">{provider}</span>
              </div>
              <div className="text-slate-400 font-mono">
                {formatNumber(stats.calls)} · {formatCost(stats.cost)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500 italic pt-2 border-t border-slate-800">
          No usage in this window
        </div>
      )}
    </div>
  )
}

/** 把 timeseries[] 轉成 Recharts 要的扁平格式：每天一個 row，欄位是各 provider 的 calls */
function buildLineChartData(timeseries: UsageDayBucket[]): Array<Record<string, string | number>> {
  const allProviders = new Set<string>()
  for (const day of timeseries) {
    Object.keys(day.byProvider).forEach((p) => allProviders.add(p))
  }

  return timeseries.map((day) => {
    const row: Record<string, string | number> = { date: day.date.slice(5) } // MM-DD
    for (const provider of allProviders) {
      row[provider] = day.byProvider[provider]?.calls ?? 0
    }
    return row
  })
}

function getActiveProviders(timeseries: UsageDayBucket[]): string[] {
  const set = new Set<string>()
  for (const day of timeseries) {
    Object.keys(day.byProvider).forEach((p) => set.add(p))
  }
  return Array.from(set).sort()
}

export function UsageDashboard() {
  const { data, isLoading, error } = useUsageStats(30)

  if (isLoading) {
    return (
      <div className="admin-card p-8">
        <LoadingCenter />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="admin-card p-6">
        <div className="text-sm text-rose-400">
          Failed to load AI usage stats. {error instanceof Error ? error.message : ''}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          確認 ai_usage_logs migration 已跑進 production，且至少有一輪 cron 寫入過資料。
        </div>
      </div>
    )
  }

  const lineData = buildLineChartData(data.timeseries)
  const activeProviders = getActiveProviders(data.timeseries)

  // pie chart：依 purpose 的成本占比（cost 比 calls 更有意義）
  const pieData = Object.entries(data.byPurpose)
    .map(([purpose, stats]) => ({ name: purpose, value: stats.cost, calls: stats.calls }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div id="usage" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">AI Usage</h2>
        <span className="text-xs text-slate-500">
          Last 30 days · {formatNumber(data.totalRows)} calls
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard title="Today" window={data.summary.today} />
        <SummaryCard title="Last 7 days" window={data.summary.last_7_days} />
        <SummaryCard title="Last 30 days" window={data.summary.last_30_days} />
      </div>

      {/* Line chart: provider trend */}
      <div className="admin-card p-4">
        <div className="text-sm font-medium text-white mb-3">Daily calls by provider</div>
        {lineData.length === 0 || activeProviders.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-12 text-center">
            No data yet — wait for the next cron run, then refresh.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {activeProviders.map((provider) => (
                <Line
                  key={provider}
                  type="monotone"
                  dataKey={provider}
                  stroke={PROVIDER_COLORS[provider] || '#94a3b8'}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie chart: cost by purpose */}
      <div className="admin-card p-4">
        <div className="text-sm font-medium text-white mb-3">Cost by purpose (last 30d)</div>
        {pieData.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-12 text-center">No cost data yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  label={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PURPOSE_COLORS[i % PURPOSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    fontSize: 12,
                  }}
                  formatter={(value) => formatCost(typeof value === 'number' ? value : 0)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 self-center">
              {pieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded"
                      style={{ backgroundColor: PURPOSE_COLORS[i % PURPOSE_COLORS.length] }}
                    />
                    <span className="text-slate-300">{entry.name}</span>
                  </div>
                  <div className="text-slate-400 font-mono">
                    {formatCost(entry.value)} · {formatNumber(entry.calls)} calls
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
