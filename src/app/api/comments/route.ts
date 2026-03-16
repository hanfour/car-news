import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { moderateComment } from '@/lib/ai/claude'
import { getErrorMessage } from '@/lib/utils/error'
import { rateLimit } from '@/lib/rate-limit'

// GET: 获取文章评论列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const articleId = searchParams.get('article_id')

  if (!articleId) {
    return NextResponse.json(
      { error: 'Missing article_id' },
      { status: 400 }
    )
  }

  try {
    const supabase = createClient()

    // 1. 先查評論
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, likes_count')
      .eq('article_id', articleId)
      .eq('is_approved', true)
      .is('parent_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Comments GET] Failed to fetch comments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch comments', details: error.message },
        { status: 500 }
      )
    }

    if (!comments || comments.length === 0) {
      return NextResponse.json({ comments: [] })
    }

    // 2. 批量查詢所有用戶的 profiles
    const userIds = [...new Set(comments.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    // 3. 手動組合資料
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const commentsWithProfiles = comments.map(comment => ({
      ...comment,
      profiles: profilesMap.get(comment.user_id) || null
    }))

    return NextResponse.json({ comments: commentsWithProfiles })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 提交新评论
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { article_id, content } = body

    // 驗證輸入
    if (!article_id || !content) {
      return NextResponse.json(
        { error: '請填寫所有必填欄位' },
        { status: 400 }
      )
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: '評論過長（最多2000字）' },
        { status: 400 }
      )
    }

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`comment:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    // AI 審核
    const moderation = await moderateComment(content)

    // 如果 confidence > 95 且有明確違規，拒絕
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json(
        { error: '您的評論包含不當內容，無法發布' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        article_id,
        user_id: userId,
        content,
        moderation_result: {
          passed: moderation.passed,
          confidence: moderation.confidence,
          flags: moderation.flags
        },
        is_approved: true  // 默認通過
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save comment:', error)
      return NextResponse.json(
        { error: '保存失敗，請稍後再試' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      comment: data
    })
  } catch (error) {
    console.error('Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: '系統錯誤，請稍後再試' },
      { status: 500 }
    )
  }
}
