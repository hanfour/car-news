import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { moderateComment } from '@/lib/ai/claude'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// POST: 新增回覆
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`forum-reply:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { content, parent_id } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: '請輸入回覆內容' }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: '回覆過長（最多5000字）' }, { status: 400 })
    }

    // AI 審核
    const moderation = await moderateComment(content)
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json({ error: '回覆包含不當內容' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('forum_replies')
      .insert({
        post_id: postId,
        user_id: userId,
        parent_id: parent_id || null,
        content,
      })
      .select()
      .single()

    if (error) {
      logger.error('api.forum.reply_create_fail', error, { postId, userId })
      return NextResponse.json({ error: '回覆失敗' }, { status: 500 })
    }

    return NextResponse.json({ reply: data })
  } catch (error) {
    logger.error('api.forum.reply_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
