import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { userId } = auth
    const supabase = createServiceClient()

    // Find target user
    let targetId = username
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (profile) targetId = profile.id

    if (targetId === userId) {
      return NextResponse.json({ error: '無法封鎖自己' }, { status: 400 })
    }

    // Check if already blocked
    const { data: existing } = await supabase
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId)
      .single()

    if (existing) {
      // Unblock
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', targetId)

      return NextResponse.json({ isBlocked: false })
    }

    // Block
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: userId, blocked_id: targetId })

    if (error) {
      console.error('[Block POST] Error:', error)
      return NextResponse.json({ error: '操作失敗' }, { status: 500 })
    }

    return NextResponse.json({ isBlocked: true })
  } catch (error) {
    console.error('[Block POST] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
