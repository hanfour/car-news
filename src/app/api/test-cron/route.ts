import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 10

export async function GET(request: NextRequest) {
  console.log('=== TEST CRON START ===')
  console.log('Headers:', Object.fromEntries(request.headers.entries()))

  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization')
  const isManualTrigger = authHeader === `Bearer ${process.env.CRON_SECRET}`

  console.log('Auth check:', { isVercelCron, isManualTrigger })

  if (!isVercelCron && !isManualTrigger) {
    console.log('=== TEST CRON UNAUTHORIZED ===')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('=== TEST CRON SUCCESS ===')
  return NextResponse.json({
    success: true,
    message: 'Test cron works!',
    timestamp: new Date().toISOString()
  })
}
