import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase'
import { moderateComment } from '@/lib/ai/claude'

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

    const { data, error } = await supabase
      .from('comments')
      .select('id, author_name, content, created_at')
      .eq('article_id', articleId)
      .eq('visible', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch comments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    return NextResponse.json({ comments: data || [] })
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
    const { article_id, author_name, content } = body

    // 验证输入
    if (!article_id || !author_name || !content) {
      return NextResponse.json(
        { error: '請填寫所有必填欄位' },
        { status: 400 }
      )
    }

    if (author_name.length > 50) {
      return NextResponse.json(
        { error: '暱稱過長（最多50字）' },
        { status: 400 }
      )
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: '評論過長（最多2000字）' },
        { status: 400 }
      )
    }

    // AI审核
    console.log('Moderating comment...')
    const moderation = await moderateComment(content)

    // 如果confidence > 95且有明确违规，拒绝
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json(
        { error: '您的評論包含不當內容，無法發布' },
        { status: 400 }
      )
    }

    // 保存评论
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('comments')
      .insert({
        article_id,
        author_name,
        content,
        ai_moderation: {
          passed: moderation.passed,
          confidence: moderation.confidence,
          flags: moderation.flags
        },
        visible: true // 默认通过
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
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤，請稍後再試' },
      { status: 500 }
    )
  }
}
