import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params
    const { reason, description } = await request.json()

    // Validate reason
    const validReasons = ['spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'other']
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json({ error: '無效的檢舉原因' }, { status: 400 })
    }

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // Check if comment exists and is not soft-deleted
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, is_deleted')
      .eq('id', commentId)
      .maybeSingle()

    if (commentError || !comment) {
      return NextResponse.json({ error: '留言不存在' }, { status: 404 })
    }
    if (comment.is_deleted) {
      // 已刪除的留言不接受新檢舉，避免管理員審核佇列被噪音佔據
      return NextResponse.json({ error: '此留言已被刪除' }, { status: 410 })
    }

    // Check if user already reported this comment
    const { data: existingReport } = await supabase
      .from('comment_reports')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: '您已經檢舉過此留言' }, { status: 400 })
    }

    // Create report
    const { error: insertError } = await supabase
      .from('comment_reports')
      .insert({
        comment_id: commentId,
        user_id: userId,
        reason,
        description: description || null,
        status: 'pending'
      })

    if (insertError) {
      logger.error('api.comments.report_create_fail', insertError, { commentId, userId })
      return NextResponse.json({ error: '檢舉失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '檢舉已提交，我們會盡快處理'
    })

  } catch (error) {
    logger.error('api.comments.report_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: getErrorMessage(error) || '檢舉失敗' },
      { status: 500 }
    )
  }
}
