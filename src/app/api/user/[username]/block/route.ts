import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

async function resolveTargetId(supabase: SupabaseClient, username: string, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  const targetId = profile?.id || username

  if (targetId === userId) {
    return { error: '無法封鎖自己', targetId: null }
  }

  return { error: null, targetId }
}

// POST: 封鎖用戶
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
    const { supabase, userId } = auth

    const rl = rateLimit(`block:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { error: resolveError, targetId } = await resolveTargetId(supabase, username, userId)
    if (resolveError || !targetId) {
      return NextResponse.json({ error: resolveError || '找不到用戶' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: userId, blocked_id: targetId })

    if (error) {
      // 已封鎖 — unique constraint violation，視為成功
      if (error.code === '23505') {
        return NextResponse.json({ isBlocked: true })
      }
      logger.error('api.user.block_fail', error, { userId, targetId })
      return NextResponse.json({ error: '操作失敗' }, { status: 500 })
    }

    return NextResponse.json({ isBlocked: true })
  } catch (error) {
    logger.error('api.user.block_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 解除封鎖
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`block:${userId}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const { error: resolveError, targetId } = await resolveTargetId(supabase, username, userId)
    if (resolveError || !targetId) {
      return NextResponse.json({ error: resolveError || '找不到用戶' }, { status: 400 })
    }

    await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId)

    return NextResponse.json({ isBlocked: false })
  } catch (error) {
    logger.error('api.user.unblock_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
