import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase'
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
    const supabase = createServiceClient()

    // 先嘗試簡單查詢看評論是否存在
    const { data: simpleData, error: simpleError } = await supabase
      .from('comments')
      .select('*')
      .eq('article_id', articleId)

    console.log('[Comments GET] Simple query:', {
      articleId,
      count: simpleData?.length,
      error: simpleError?.message
    })

    // 然後嘗試帶 profiles 的查詢
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles (
          display_name,
          avatar_url
        )
      `)
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

    console.log('[Comments GET] Success:', {
      count: data?.length,
      comments: data
    })

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

    // 獲取當前用戶（從 Authorization header 讀取 token）
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Comments API] No auth header')
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Ignore errors in API routes
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Ignore errors in API routes
            }
          },
        },
      }
    )

    // 使用 token 驗證用戶
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    console.log('[Comments API] Auth check:', {
      hasAuthHeader: !!authHeader,
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    })

    if (authError || !user) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }

    // AI 審核
    console.log('Moderating comment...')
    const moderation = await moderateComment(content)

    // 如果 confidence > 95 且有明確違規，拒絕
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json(
        { error: '您的評論包含不當內容，無法發布' },
        { status: 400 }
      )
    }

    // 保存評論（使用 service client 繞過 RLS）
    const serviceClient = createServiceClient()

    const { data, error } = await serviceClient
      .from('comments')
      .insert({
        article_id,
        user_id: user.id,
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
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤，請稍後再試' },
      { status: 500 }
    )
  }
}
