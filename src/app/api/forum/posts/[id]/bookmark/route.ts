import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

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
    const { userId } = auth
    const supabase = createServiceClient()

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
