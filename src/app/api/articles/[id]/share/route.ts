import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getErrorMessage } from '@/lib/utils/error'
import { logger } from '@/lib/logger'

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

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

    // Rate limit：avoid bots/scripts pumping share_count
    // - Authed: 30 shares / min / user
    // - Anon: 10 shares / min / IP（用 IP 作 key，配上 articleId 不夠細，但避免同 IP 對單篇瘋狂呼叫）
    const rlKey = userId ? `share:user:${userId}` : `share:ip:${getClientIp(request)}`
    const rl = rateLimit(rlKey, {
      maxRequests: userId ? 30 : 10,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

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
