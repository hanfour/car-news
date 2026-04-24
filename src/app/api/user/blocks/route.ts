import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET: 取得當前用戶的封鎖名單
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { data: blocks, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('api.user.blocks_list_fail', error, { userId })
      return NextResponse.json({ error: '載入封鎖名單失敗' }, { status: 500 })
    }

    if (!blocks || blocks.length === 0) {
      return NextResponse.json({ blocks: [] })
    }

    // 取得封鎖用戶的 profile 資訊
    const blockedIds = blocks.map(b => b.blocked_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', blockedIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const result = blocks.map(b => ({
      blocked_id: b.blocked_id,
      created_at: b.created_at,
      profile: profileMap.get(b.blocked_id) || null,
    }))

    return NextResponse.json({ blocks: result })
  } catch (error) {
    logger.error('api.user.blocks_list_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
