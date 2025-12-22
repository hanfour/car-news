import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error'

export async function GET(request: NextRequest) {
  // 驗證 Admin API Key
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    // 1. 檢查 raw_articles 狀態
    const { data: rawArticles, error: rawError } = await supabase
      .from('raw_articles')
      .select('id, scraped_at, embedding')
      .gt('expires_at', new Date().toISOString())

    if (rawError) {
      throw new Error(`Raw articles query failed: ${rawError.message}`)
    }

    const today = new Date().toISOString().split('T')[0]
    const todayArticles = rawArticles?.filter(a => a.scraped_at?.startsWith(today)) || []
    const withoutEmbedding = rawArticles?.filter(a => !a.embedding) || []

    // 2. 檢查 generated_articles 狀態
    const { data: generatedArticles, error: genError } = await supabase
      .from('generated_articles')
      .select('id, created_at, published')
      .gte('created_at', today)

    if (genError) {
      throw new Error(`Generated articles query failed: ${genError.message}`)
    }

    // 3. 檢查最近的 cron logs
    const { data: cronLogs, error: logError } = await supabase
      .from('cron_logs')
      .select('job_name, status, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(10)

    if (logError) {
      throw new Error(`Cron logs query failed: ${logError.message}`)
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      raw_articles: {
        total: rawArticles?.length || 0,
        today: todayArticles.length,
        without_embedding: withoutEmbedding.length,
        last_scraped: rawArticles?.[0]?.scraped_at || null
      },
      generated_articles: {
        today: generatedArticles?.length || 0,
        published_today: generatedArticles?.filter(a => a.published).length || 0
      },
      recent_cron_logs: cronLogs?.map(log => ({
        job: log.job_name,
        status: log.status,
        time: log.created_at,
        metadata: log.metadata
      })) || []
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
