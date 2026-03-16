import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// POST: 按讚/取消按讚貼文
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

    const { data: existing } = await supabase
      .from('forum_likes')
      .select('user_id')
      .eq('user_id', userId)
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('forum_likes')
        .delete()
        .eq('user_id', userId)
        .eq('target_type', 'post')
        .eq('target_id', postId)

      return NextResponse.json({ isLiked: false })
    } else {
      const { error } = await supabase.from('forum_likes').insert({
        user_id: userId,
        target_type: 'post',
        target_id: postId,
      })

      // 處理並發請求導致的 unique constraint violation
      if (error?.code === '23505') {
        return NextResponse.json({ isLiked: true })
      }

      return NextResponse.json({ isLiked: true })
    }
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
