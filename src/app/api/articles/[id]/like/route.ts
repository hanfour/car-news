import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'

// POST: Toggle like on an article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params

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
      .from('article_likes')
      .select('article_id, user_id')
      .eq('article_id', articleId)
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError) {
      console.error('[Article Like API] Error checking existing like:', checkError)
      return NextResponse.json(
        { error: '查詢失敗' },
        { status: 500 }
      )
    }

    if (existingLike) {
      // Unlike: Remove the like
      const { error: deleteError } = await supabase
        .from('article_likes')
        .delete()
        .eq('article_id', articleId)
        .eq('user_id', userId)

      if (deleteError) {
        console.error('[Article Like API] Error removing like:', deleteError)
        return NextResponse.json(
          { error: '取消按讚失敗' },
          { status: 500 }
        )
      }

      // Get updated like count
      const { data: article } = await supabase
        .from('generated_articles')
        .select('likes_count')
        .eq('id', articleId)
        .single()

      return NextResponse.json({
        success: true,
        isLiked: false,
        likeCount: article?.likes_count || 0
      })
    } else {
      // Like: Add new like
      const { error: insertError } = await supabase
        .from('article_likes')
        .insert({
          article_id: articleId,
          user_id: userId
        })

      if (insertError) {
        console.error('[Article Like API] Error adding like:', insertError)
        return NextResponse.json(
          { error: '按讚失敗' },
          { status: 500 }
        )
      }

      // Get updated like count
      const { data: article } = await supabase
        .from('generated_articles')
        .select('likes_count')
        .eq('id', articleId)
        .single()

      return NextResponse.json({
        success: true,
        isLiked: true,
        likeCount: article?.likes_count || 0
      })
    }
  } catch (error) {
    console.error('[Article Like API] Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}

// GET: Check if user has liked an article and get like count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params

    const supabase = createClient()

    // Get like count
    const { data: article } = await supabase
      .from('generated_articles')
      .select('likes_count')
      .eq('id', articleId)
      .single()

    let isLiked = false

    // Check if user has liked (if authenticated)
    const auth = await createAuthenticatedClient(request)
    if (auth) {
      const { data: like } = await auth.supabase
        .from('article_likes')
        .select('article_id')
        .eq('article_id', articleId)
        .eq('user_id', auth.userId)
        .maybeSingle()

      isLiked = !!like
    }

    return NextResponse.json({
      likeCount: article?.likes_count || 0,
      isLiked
    })
  } catch (error) {
    console.error('[Article Like API GET] Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
