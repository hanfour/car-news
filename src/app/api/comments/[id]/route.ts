import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { moderateComment } from '@/lib/ai/claude'
import { getErrorMessage } from '@/lib/utils/error'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// PATCH: 編輯評論（僅作者可操作）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`comment-edit:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: '評論內容不能為空' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: '評論過長（最多2000字）' }, { status: 400 })
    }

    // AI 審核
    const moderation = await moderateComment(content.trim())
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json({ error: '您的評論包含不當內容，無法發布' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('comments')
      .update({
        content: content.trim(),
        moderation_result: {
          passed: moderation.passed,
          confidence: moderation.confidence,
          flags: moderation.flags,
        },
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .select('id, content, created_at, user_id, likes_count')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '更新失敗，請確認您是評論作者' }, { status: 404 })
    }

    return NextResponse.json({ success: true, comment: data })
  } catch (error) {
    logger.error('api.comments.update_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 軟刪除評論（僅作者可操作）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`comment-delete:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { data, error } = await supabase
      .from('comments')
      .update({ is_deleted: true, content: '' })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '刪除失敗，請確認您是評論作者' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('api.comments.delete_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
