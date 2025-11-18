import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'

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

    // Get user (required for reporting)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '需要登入才能檢舉' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify user with auth client
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {},
        },
      }
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: '認證失敗' }, { status: 401 })
    }

    // Use service client for database operations
    const supabase = createServiceClient()

    // Check if comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id')
      .eq('id', commentId)
      .single()

    if (commentError || !comment) {
      return NextResponse.json({ error: '留言不存在' }, { status: 404 })
    }

    // Check if user already reported this comment
    const { data: existingReport } = await supabase
      .from('comment_reports')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: '您已經檢舉過此留言' }, { status: 400 })
    }

    // Create report
    const { error: insertError } = await supabase
      .from('comment_reports')
      .insert({
        comment_id: commentId,
        user_id: user.id,
        reason,
        description: description || null,
        status: 'pending'
      })

    if (insertError) {
      console.error('Failed to create comment report:', insertError)
      return NextResponse.json({ error: '檢舉失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '檢舉已提交，我們會盡快處理'
    })

  } catch (error: any) {
    console.error('Comment report error:', error)
    return NextResponse.json(
      { error: error.message || '檢舉失敗' },
      { status: 500 }
    )
  }
}
