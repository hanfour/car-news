import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { publishSocialPost } from '@/lib/social/auto-publisher'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/social-posts/batch-publish
 * 批量發布所有 pending 狀態的社群貼文
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthorized = await verifyAdminAuth(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // 查詢所有 pending 貼文
    const { data: pendingPosts, error } = await supabase
      .from('social_posts')
      .select('id, platform')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(30)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch pending posts' },
        { status: 500 }
      )
    }

    if (!pendingPosts || pendingPosts.length === 0) {
      return NextResponse.json({
        total: 0,
        published: 0,
        failed: 0,
        results: []
      })
    }

    const results: Array<{
      postId: string
      platform: string
      success: boolean
      postUrl?: string
      error?: string
    }> = []

    let published = 0
    let failed = 0

    for (const post of pendingPosts) {
      const result = await publishSocialPost(post.id)

      results.push({
        postId: post.id,
        platform: post.platform,
        success: result.success,
        postUrl: result.postUrl,
        error: result.error
      })

      if (result.success) {
        published++
      } else {
        failed++
      }

      // 每次發布間隔 1 秒，避免 rate limit
      if (post !== pendingPosts[pendingPosts.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      total: pendingPosts.length,
      published,
      failed,
      results
    })
  } catch (error) {
    logger.error('api.admin.social_batch_publish_fail', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
