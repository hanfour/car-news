import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`bookmark:${userId}`, { maxRequests: 30, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from('forum_bookmarks')
      .select('user_id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle()

    if (existing) {
      // Remove bookmark（bookmark_count 由 DB trigger 自動更新）
      await supabase
        .from('forum_bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId)

      return NextResponse.json({ isBookmarked: false })
    }

    // Add bookmark（bookmark_count 由 DB trigger 自動更新）
    const { error } = await supabase
      .from('forum_bookmarks')
      .insert({ user_id: userId, post_id: postId })

    // 處理並發請求導致的 unique constraint violation
    if (error?.code === '23505') {
      return NextResponse.json({ isBookmarked: true })
    }

    if (error) {
      console.error('[Bookmark POST] Error:', error)
      return NextResponse.json({ error: '書籤操作失敗' }, { status: 500 })
    }

    return NextResponse.json({ isBookmarked: true })
  } catch (error) {
    console.error('[Bookmark POST] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
