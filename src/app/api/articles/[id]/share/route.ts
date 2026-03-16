import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { getErrorMessage } from '@/lib/utils/error'

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
      console.error('[Article Share API] Error recording share:', insertError)
      return NextResponse.json(
        { error: '記錄分享失敗' },
        { status: 500 }
      )
    }

    // Get updated share count
    const readClient = createClient()
    const { data: article } = await readClient
      .from('generated_articles')
      .select('share_count')
      .eq('id', articleId)
      .single()

    return NextResponse.json({
      success: true,
      shareCount: article?.share_count || 0
    })
  } catch (error) {
    console.error('[Article Share API] Unexpected error:', getErrorMessage(error))
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
    console.error('[Article Share API GET] Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
