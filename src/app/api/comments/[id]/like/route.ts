import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'

// POST: Toggle like on a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }
    const { supabase, userId } = auth

    // Check if already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
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
        .eq('user_id', userId)

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
          user_id: userId
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
  } catch (error) {
    console.error('[Like API] Unexpected error:', getErrorMessage(error))
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

    const supabase = createClient()

    // Get like count
    const { data: comment } = await supabase
      .from('comments')
      .select('likes_count')
      .eq('id', commentId)
      .single()

    let isLiked = false

    // Check if user has liked (if authenticated)
    const auth = await createAuthenticatedClient(request)
    if (auth) {
      const { data: like } = await auth.supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('comment_id', commentId)
        .eq('user_id', auth.userId)
        .maybeSingle()

      isLiked = !!like
    }

    return NextResponse.json({
      likeCount: comment?.likes_count || 0,
      isLiked
    })
  } catch (error) {
    console.error('[Like API GET] Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
