import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const { reason, description } = await request.json()

    const validReasons = ['spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'other']
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json({ error: '無效的檢舉原因' }, { status: 400 })
    }

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('forum_posts')
      .select('id')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: '貼文不存在' }, { status: 404 })
    }

    const { error: insertError } = await supabase
      .from('forum_post_reports')
      .insert({
        post_id: postId,
        user_id: userId,
        reason,
        description: description || null,
        status: 'pending',
      })

    if (insertError) {
      // Unique constraint violation = already reported
      if (insertError.code === '23505') {
        return NextResponse.json({ error: '您已經檢舉過此貼文' }, { status: 400 })
      }
      logger.error('api.forum.post_report_fail', insertError, { postId, userId })
      return NextResponse.json({ error: '檢舉失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '檢舉已提交，我們會盡快處理',
    })
  } catch (error) {
    logger.error('api.forum.post_report_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: getErrorMessage(error) || '檢舉失敗' },
      { status: 500 }
    )
  }
}
