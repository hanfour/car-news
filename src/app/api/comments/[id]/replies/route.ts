import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { moderateComment } from '@/lib/ai/claude'

// GET: Fetch replies for a comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params

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

    // Fetch replies
    const { data: replies, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, likes_count')
      .eq('parent_id', parentId)
      .eq('is_approved', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Replies API] Error fetching replies:', error)
      return NextResponse.json(
        { error: '查詢失敗' },
        { status: 500 }
      )
    }

    if (!replies || replies.length === 0) {
      return NextResponse.json({ replies: [] })
    }

    // Fetch profiles for all reply authors
    const userIds = [...new Set(replies.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    // Map profiles to replies
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])
    const repliesWithProfiles = replies.map(reply => ({
      ...reply,
      profiles: profilesMap.get(reply.user_id) || null
    }))

    return NextResponse.json({ replies: repliesWithProfiles })
  } catch (error: any) {
    console.error('[Replies API GET] Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤' },
      { status: 500 }
    )
  }
}

// POST: Add a reply to a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params
    const body = await request.json()
    const { content } = body

    // Validate input
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '請填寫回覆內容' },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: '回覆過長（最多1000字）' },
        { status: 400 }
      )
    }

    // Get auth token
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }

    // Get parent comment to extract article_id
    const { data: parentComment, error: parentError } = await supabase
      .from('comments')
      .select('article_id, id')
      .eq('id', parentId)
      .single()

    if (parentError || !parentComment) {
      return NextResponse.json(
        { error: '找不到原評論' },
        { status: 404 }
      )
    }

    // AI moderation
    console.log('[Reply API] Moderating reply...')
    const moderation = await moderateComment(content)

    // Reject if high confidence violation
    if (moderation.confidence > 95 && moderation.flags.length > 0) {
      return NextResponse.json(
        { error: '您的回覆包含不當內容，無法發布' },
        { status: 400 }
      )
    }

    // Insert reply
    const { data: reply, error: insertError } = await supabase
      .from('comments')
      .insert({
        article_id: parentComment.article_id,
        parent_id: parentId,
        user_id: user.id,
        content: content.trim(),
        moderation_result: {
          passed: moderation.passed,
          confidence: moderation.confidence,
          flags: moderation.flags
        },
        is_approved: true
      })
      .select('id, content, created_at, user_id, likes_count')
      .single()

    if (insertError) {
      console.error('[Reply API] Error inserting reply:', insertError)
      return NextResponse.json(
        { error: '保存失敗，請稍後再試' },
        { status: 500 }
      )
    }

    // Fetch profile for the reply author
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      reply: {
        ...reply,
        profiles: profile
      }
    })
  } catch (error: any) {
    console.error('[Reply API POST] Unexpected error:', error)
    return NextResponse.json(
      { error: '系統錯誤，請稍後再試' },
      { status: 500 }
    )
  }
}
