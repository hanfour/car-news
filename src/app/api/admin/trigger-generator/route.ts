import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // 驗證 admin 權限
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value

    if (!token || token !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 獲取當前域名
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    // 呼叫 generator endpoint
    const response = await fetch(`${baseUrl}/api/cron/generator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    })

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Generator triggered successfully',
        result: data
      })
    } else {
      return NextResponse.json({
        success: false,
        error: data.error || 'Failed to trigger generator',
        details: data
      }, { status: response.status })
    }
  } catch (error) {
    console.error('Trigger generator error:', error)
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
