import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error'

/**
 * GET /api/admin/usage?days=30
 *
 * 回傳 ai_usage_logs 的聚合資料供 admin dashboard 用：
 * - summary: today / 7d / 30d 的 calls 與 cost 總和（含 by-provider breakdown）
 * - timeseries: 過去 N 天每日各 provider 的 calls 與 cost
 * - byPurpose: 各 purpose（article_generation / moderation / 等）的累計
 *
 * 全部 in-memory aggregation；以 30 天 × ~50 calls/day = 1500 rows 規模做設計。
 */

interface DailyBucket {
  date: string
  byProvider: Record<string, { calls: number; cost: number }>
}

interface UsageRow {
  provider: string
  model: string | null
  purpose: string
  cost_usd: string | number | null
  created_at: string
  success: boolean
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30'), 1), 90)

  try {
    const supabase = createServiceClient()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: rows, error } = await supabase
      .from('ai_usage_logs')
      .select('provider, model, purpose, cost_usd, created_at, success')
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('admin.usage.query_fail', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const usage = (rows ?? []) as UsageRow[]

    // ---- summary windows ----
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()

    const summary = {
      today: aggregateWindow(usage, todayStart),
      last_7_days: aggregateWindow(usage, now - 7 * oneDayMs),
      last_30_days: aggregateWindow(usage, now - 30 * oneDayMs),
    }

    // ---- timeseries (per day, per provider) ----
    const dayMap = new Map<string, DailyBucket>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * oneDayMs)
      const key = d.toISOString().split('T')[0]
      dayMap.set(key, { date: key, byProvider: {} })
    }
    for (const row of usage) {
      const dayKey = row.created_at.split('T')[0]
      const bucket = dayMap.get(dayKey)
      if (!bucket) continue
      const slot = (bucket.byProvider[row.provider] ??= { calls: 0, cost: 0 })
      slot.calls += 1
      slot.cost += Number(row.cost_usd ?? 0)
    }
    const timeseries = Array.from(dayMap.values())

    // ---- by purpose ----
    const byPurpose: Record<string, { calls: number; cost: number }> = {}
    for (const row of usage) {
      const slot = (byPurpose[row.purpose] ??= { calls: 0, cost: 0 })
      slot.calls += 1
      slot.cost += Number(row.cost_usd ?? 0)
    }

    return NextResponse.json({
      windowDays: days,
      summary,
      timeseries,
      byPurpose,
      totalRows: usage.length,
    })
  } catch (error) {
    logger.error('admin.usage.unexpected', error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

function aggregateWindow(rows: UsageRow[], sinceMs: number) {
  const since = new Date(sinceMs).getTime()
  let calls = 0
  let cost = 0
  const byProvider: Record<string, { calls: number; cost: number }> = {}

  for (const row of rows) {
    const t = new Date(row.created_at).getTime()
    if (t < since) continue
    calls += 1
    cost += Number(row.cost_usd ?? 0)
    const slot = (byProvider[row.provider] ??= { calls: 0, cost: 0 })
    slot.calls += 1
    slot.cost += Number(row.cost_usd ?? 0)
  }

  return { calls, cost, byProvider }
}
