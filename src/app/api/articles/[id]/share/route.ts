import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

// POST: Record a share event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params
    const { platform } = await request.json()

    // Validate platform
    const validPlatforms = ['facebook', 'twitter', 'line', 'instagram', 'copy']
    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: '無效的分享平台' },
        { status: 400 }
      )
    }

    // Auth is optional for shares
    const auth = await createAuthenticatedClient(request)
    const userId = auth?.userId || null

    // Use auth client if available, otherwise anon
    const supabase = auth?.supabase || createClient()

    // Record share event
    const { error: insertError } = await supabase
      .from('article_shares')
      .insert({
        article_id: articleId,
        user_id: userId,
        platform
      })

    if (insertError) {
      logger.error('api.articles.share_record_fail', insertError, { articleId, platform })
      return NextResponse.json(
        { error: '記錄分享失敗' },
        { status: 500 }
      )
    }

    // Get updated share count（generated_articles 沒有 RLS，任何 client 都可讀）
    const { data: article } = await supabase
      .from('generated_articles')
      .select('share_count')
      .eq('id', articleId)
      .single()

    return NextResponse.json({
      success: true,
      shareCount: article?.share_count || 0
    })
  } catch (error) {
    logger.error('api.articles.share_post_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}

// GET: Get share count for an article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params

    const supabase = createClient()

    // Get share count
    const { data: article } = await supabase
      .from('generated_articles')
      .select('share_count')
      .eq('id', articleId)
      .single()

    return NextResponse.json({
      shareCount: article?.share_count || 0
    })
  } catch (error) {
    logger.error('api.articles.share_get_unexpected', error, { message: getErrorMessage(error) })
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
