import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET: 查詢當前用戶是否已追蹤目標用戶
export async function GET(
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

    // 找到目標用戶
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)
    let profileQuery = supabase.from('profiles').select('id')
    if (isUuid) {
      profileQuery = profileQuery.eq('id', username)
    } else {
      profileQuery = profileQuery.eq('username', username)
    }
    const { data: targetProfile } = await profileQuery.single()

    if (!targetProfile) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('follower_id', userId)
      .eq('following_id', targetProfile.id)
      .maybeSingle()

    return NextResponse.json({ isFollowing: !!existing })
  } catch (error) {
    logger.error('api.user.follow_get_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 追蹤/取消追蹤（toggle）
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

    // 找到目標用戶
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)
    let profileQuery = supabase.from('profiles').select('id')
    if (isUuid) {
      profileQuery = profileQuery.eq('id', username)
    } else {
      profileQuery = profileQuery.eq('username', username)
    }
    const { data: targetProfile } = await profileQuery.single()

    if (!targetProfile) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    if (targetProfile.id === userId) {
      return NextResponse.json({ error: '不能追蹤自己' }, { status: 400 })
    }

    // 檢查是否已追蹤
    const { data: existing } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('follower_id', userId)
      .eq('following_id', targetProfile.id)
      .maybeSingle()

    if (existing) {
      // 取消追蹤
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', targetProfile.id)

      if (error) {
        logger.error('api.user.unfollow_fail', error, { userId, targetId: targetProfile.id })
        return NextResponse.json({ error: '取消追蹤失敗' }, { status: 500 })
      }
      return NextResponse.json({ isFollowing: false })
    } else {
      // 追蹤
      const { error } = await supabase
        .from('user_follows')
        .insert({ follower_id: userId, following_id: targetProfile.id })

      if (error) {
        logger.error('api.user.follow_fail', error, { userId, targetId: targetProfile.id })
        return NextResponse.json({ error: '追蹤失敗' }, { status: 500 })
      }
      return NextResponse.json({ isFollowing: true })
    }
  } catch (error) {
    logger.error('api.user.follow_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
