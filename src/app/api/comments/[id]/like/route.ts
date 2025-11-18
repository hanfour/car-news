import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST: Toggle like on a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params

    // Get auth token from header
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Create Supabase client
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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }

    // Check if already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError) {
      console.error('[Like API] Error checking existing like:', checkError)
      return NextResponse.json(
        { error: '查詢失敗' },
        { status: 500 }
      )
    }

    if (existingLike) {
      // Unlike: Remove the like
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('[Like API] Error removing like:', deleteError)
        return NextResponse.json(
          { error: '取消按讚失敗' },
          { status: 500 }
        )
      }

      // Get updated like count
      const { data: comment } = await supabase
        .from('comments')
        .select('likes_count')
        .eq('id', commentId)
        .single()

      return NextResponse.json({
        success: true,
        isLiked: false,
        likeCount: comment?.likes_count || 0
      })
    } else {
      // Like: Add new like
      const { error: insertError } = await supabase
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: user.id
        })

      if (insertError) {
        console.error('[Like API] Error adding like:', insertError)
        return NextResponse.json(
          { error: '按讚失敗' },
          { status: 500 }
        )
      }

      // Get updated like count
      const { data: comment } = await supabase
        .from('comments')
        .select('likes_count')
        .eq('id', commentId)
        .single()

      return NextResponse.json({
        success: true,
        isLiked: true,
        likeCount: comment?.likes_count || 0
      })
    }
  } catch (error: any) {
    console.error('[Like API] Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}

// GET: Check if user has liked a comment and get like count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params

    // Get auth token from header (optional for GET)
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

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
              // Ignore errors
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Ignore errors
            }
          },
        },
      }
    )

    // Get like count
    const { data: comment } = await supabase
      .from('comments')
      .select('likes_count')
      .eq('id', commentId)
      .single()

    let isLiked = false

    // Check if user has liked (if authenticated)
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)

      if (user) {
        const { data: like } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
          .maybeSingle()

        isLiked = !!like
      }
    }

    return NextResponse.json({
      likeCount: comment?.likes_count || 0,
      isLiked
    })
  } catch (error: any) {
    console.error('[Like API GET] Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
