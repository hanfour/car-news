import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// POST: 按讚/取消按讚回覆
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: replyId } = await params

    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { data: existing } = await supabase
      .from('forum_likes')
      .select('user_id')
      .eq('user_id', userId)
      .eq('target_type', 'reply')
      .eq('target_id', replyId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('forum_likes')
        .delete()
        .eq('user_id', userId)
        .eq('target_type', 'reply')
        .eq('target_id', replyId)

      return NextResponse.json({ isLiked: false })
    } else {
      await supabase.from('forum_likes').insert({
        user_id: userId,
        target_type: 'reply',
        target_id: replyId,
      })

      return NextResponse.json({ isLiked: true })
    }
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
