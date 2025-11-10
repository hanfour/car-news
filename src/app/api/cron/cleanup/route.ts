import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const maxDuration = 30 // 清理任务应该很快

export async function GET(request: NextRequest) {
  // 验证Cron密钥
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const supabase = createServiceClient()
    const results: Record<string, number> = {}

    // 1. 清理过期的raw_articles（72小时前）
    const { count: expiredArticles } = await supabase
      .from('raw_articles')
      .delete({ count: 'exact' })
      .lt('expires_at', new Date().toISOString())

    results.expired_articles = expiredArticles || 0

    // 2. 清理旧的daily_topic_locks（7天前）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const { count: oldLocks } = await supabase
      .from('daily_topic_locks')
      .delete({ count: 'exact' })
      .lt('date', sevenDaysAgo)

    results.old_locks = oldLocks || 0

    // 3. 清理旧的cron_logs（30天前）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { count: oldLogs } = await supabase
      .from('cron_logs')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo)

    results.old_logs = oldLogs || 0

    // 4. 记录清理日志
    await supabase.from('cron_logs').insert({
      job_name: 'cleanup',
      status: 'success',
      metadata: {
        ...results,
        duration_ms: Date.now() - startTime
      }
    })

    return NextResponse.json({
      success: true,
      cleaned: results,
      duration: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Cleanup error:', error)

    // 记录错误日志
    try {
      const supabase = createServiceClient()
      await supabase.from('cron_logs').insert({
        job_name: 'cleanup',
        status: 'error',
        metadata: {
          error: error.message,
          duration_ms: Date.now() - startTime
        }
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      {
        error: error.message,
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}
