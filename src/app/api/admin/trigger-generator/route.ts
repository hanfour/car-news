import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 獲取當前域名
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    // 異步觸發 generator（不等待完成）
    // 這樣可以避免 504 Gateway Timeout
    fetch(`${baseUrl}/api/cron/generator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    }).then(response => {
      if (response.ok) {
        logger.info('api.admin.trigger_generator_ok')
      } else {
        logger.error('api.admin.trigger_generator_fail', null, { status: response.status })
      }
    }).catch(error => {
      logger.error('api.admin.trigger_generator_error', error)
    })

    // 立即返回成功響應
    return NextResponse.json({
      success: true,
      message: 'Generator triggered successfully (running in background)',
      note: 'The generation process is running. Check logs for progress.'
    })
  } catch (error) {
    logger.error('api.admin.trigger_generator_unexpected', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
