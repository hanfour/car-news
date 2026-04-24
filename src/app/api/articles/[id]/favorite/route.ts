import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

// POST: Toggle favorite on an article
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

    // Check if already favorited
    const { data: existingFavorite, error: checkError } = await supabase
      .from('user_favorites')
      .select('article_id, user_id')
      .eq('article_id', articleId)
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError) {
      logger.error('api.articles.favorite_check_fail', checkError, { articleId, userId })
      return NextResponse.json(
        { error: '查詢失敗' },
        { status: 500 }
      )
    }

    if (existingFavorite) {
      // Unfavorite: Remove the favorite
      const { error: deleteError } = await supabase
        .from('user_favorites')
        .delete()
        .eq('article_id', articleId)
        .eq('user_id', userId)

      if (deleteError) {
        logger.error('api.articles.favorite_remove_fail', deleteError, { articleId, userId })
        return NextResponse.json(
          { error: '取消收藏失敗' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        isFavorited: false
      })
    } else {
      // Favorite: Add new favorite
      const { error: insertError } = await supabase
        .from('user_favorites')
        .insert({
          article_id: articleId,
          user_id: userId
        })

      if (insertError) {
        logger.error('api.articles.favorite_add_fail', insertError, { articleId, userId })
        return NextResponse.json(
          { error: '收藏失敗' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        isFavorited: true
      })
    }
  } catch (error) {
    logger.error('api.articles.favorite_toggle_fail', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}

// GET: Check if user has favorited an article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params

    let isFavorited = false

    const auth = await createAuthenticatedClient(request)
    if (auth) {
      const { data: favorite } = await auth.supabase
        .from('user_favorites')
        .select('article_id')
        .eq('article_id', articleId)
        .eq('user_id', auth.userId)
        .maybeSingle()

      isFavorited = !!favorite
    }

    return NextResponse.json({ isFavorited })
  } catch (error) {
    logger.error('api.articles.favorite_get_fail', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
