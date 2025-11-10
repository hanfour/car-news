import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const VALID_PLATFORMS = ['facebook', 'twitter', 'line', 'copy'] as const
type Platform = typeof VALID_PLATFORMS[number]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { article_id, platform } = body

    // 验证输入
    if (!article_id || !platform) {
      return NextResponse.json(
        { error: 'Missing article_id or platform' },
        { status: 400 }
      )
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      )
    }

    // 记录分享事件
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('share_events')
      .insert({
        article_id,
        platform
      })

    if (error) {
      console.error('Failed to log share event:', error)
      return NextResponse.json(
        { error: 'Failed to log share event' },
        { status: 500 }
      )
    }

    // 触发器会自动增加 share_count
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
