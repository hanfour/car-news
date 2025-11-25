import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { postToFacebookPage, postToInstagram } from '@/lib/social/meta-client'
import { postToThreads } from '@/lib/social/threads-client'
import { formatPostContent, validatePostContent } from '@/lib/social/content-generator'
import { verifyAdminAuth } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute

/**
 * POST /api/admin/social-posts/publish
 * 批准並發布社群貼文
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
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

    const supabase = createServiceClient()

    // 獲取貼文資訊
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.status === 'posted') {
      return NextResponse.json(
        { error: 'Post already published' },
        { status: 400 }
      )
    }

    // 格式化貼文內容
    const content = formatPostContent(
      post.content,
      post.article_url,
      post.platform
    )

    // 驗證內容
    const validation = validatePostContent(content, post.platform)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // 獲取平台認證資訊
    const { data: credentials, error: credError } = await supabase
      .from('meta_credentials')
      .select('*')
      .eq('platform', post.platform)
      .eq('is_active', true)
      .single()

    if (credError || !credentials) {
      return NextResponse.json(
        { error: `No active credentials for ${post.platform}` },
        { status: 500 }
      )
    }

    // 根據平台發文
    let result

    try {
      if (post.platform === 'facebook') {
        result = await postToFacebookPage(
          {
            accessToken: credentials.access_token,
            pageId: credentials.page_id
          },
          {
            message: content,
            link: post.article_url
          }
        )
      } else if (post.platform === 'instagram') {
        result = await postToInstagram(
          {
            accessToken: credentials.access_token,
            instagramAccountId: credentials.instagram_account_id
          },
          {
            message: content,
            link: post.article_url
          }
        )
      } else if (post.platform === 'threads') {
        result = await postToThreads(
          {
            accessToken: credentials.access_token,
            threadsUserId: credentials.instagram_account_id // Threads 使用 IG account ID
          },
          {
            text: content,
            link: post.article_url
          }
        )
      } else {
        return NextResponse.json(
          { error: 'Unsupported platform' },
          { status: 400 }
        )
      }

      // 更新貼文狀態
      if (result.success) {
        await supabase
          .from('social_posts')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            post_url: result.postUrl,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', postId)

        return NextResponse.json({
          success: true,
          postUrl: result.postUrl
        })
      } else {
        // 發文失敗，記錄錯誤
        await supabase
          .from('social_posts')
          .update({
            status: 'failed',
            error_message: result.error,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', postId)

        return NextResponse.json(
          {
            success: false,
            error: result.error
          },
          { status: 500 }
        )
      }
    } catch (error) {
      console.error('[Social Post Publish] Error:', error)

      // 更新為失敗狀態
      await supabase
        .from('social_posts')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', postId)

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Social Post Publish] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
