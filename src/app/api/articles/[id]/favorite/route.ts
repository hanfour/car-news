import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'

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
      console.error('[Favorite API] Error checking existing favorite:', checkError)
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
        console.error('[Favorite API] Error removing favorite:', deleteError)
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
        console.error('[Favorite API] Error adding favorite:', insertError)
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
    console.error('[Favorite API] Unexpected error:', getErrorMessage(error))
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

    // Use service client
    const supabase = createServiceClient()

    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    let isFavorited = false

    // Check if user has favorited (if authenticated)
    if (token) {
      const cookieStore = await cookies()
      const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set() {},
            remove() {}
          }
        }
      )

      const { data: { user } } = await authClient.auth.getUser(token)

      if (user) {
        const { data: favorite } = await supabase
          .from('user_favorites')
          .select('article_id')
          .eq('article_id', articleId)
          .eq('user_id', user.id)
          .maybeSingle()

        isFavorited = !!favorite
      }
    }

    return NextResponse.json({ isFavorited })
  } catch (error) {
    console.error('[Favorite API GET] Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
