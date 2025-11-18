import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase'

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

    // Use service client for database operations
    const supabase = createServiceClient()

    // Get auth token from header (optional for shares)
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')

      // Create auth client to verify user
      const cookieStore = await cookies()
      const authClient = createServerClient(
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

      const { data: { user } } = await authClient.auth.getUser(token)
      userId = user?.id || null
    }

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
    const { data: article } = await supabase
      .from('generated_articles')
      .select('share_count')
      .eq('id', articleId)
      .single()

    return NextResponse.json({
      success: true,
      shareCount: article?.share_count || 0
    })
  } catch (error: any) {
    console.error('[Article Share API] Unexpected error:', error)
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

    // Use service client for database reads
    const supabase = createServiceClient()

    // Get share count
    const { data: article } = await supabase
      .from('generated_articles')
      .select('share_count')
      .eq('id', articleId)
      .single()

    return NextResponse.json({
      shareCount: article?.share_count || 0
    })
  } catch (error: any) {
    console.error('[Article Share API GET] Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}
