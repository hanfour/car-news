import { NextRequest, NextResponse } from 'next/server'
import { publishSocialPost } from '@/lib/social/auto-publisher'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/social-posts/publish
 * 批准並發布社群貼文
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { postId } = body as { postId: string }

    if (!postId) {
      return NextResponse.json(
        { error: 'Missing post ID' },
        { status: 400 }
      )
    }

    const result = await publishSocialPost(postId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        postUrl: result.postUrl
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('api.admin.social_publish_fail', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
