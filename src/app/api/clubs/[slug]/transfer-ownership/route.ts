import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/clubs/[slug]/transfer-ownership
 * Body: { newOwnerId: UUID }
 *
 * 將社團 owner 權限轉給另一位 active member。原 owner 會被降為 admin。
 * 整個轉移是 atomic（DB function 包成 transaction），避免中途 inconsistent state。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    // 嚴格 rate limit — owner 轉讓是低頻、敏感操作
    const rl = rateLimit(`club-transfer:${userId}`, { maxRequests: 5, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const newOwnerId = body?.newOwnerId
    if (!newOwnerId || typeof newOwnerId !== 'string' || !UUID_RE.test(newOwnerId)) {
      return NextResponse.json({ error: '無效的接管人 ID' }, { status: 400 })
    }

    // 找出 club id（slug → id）
    const { data: club } = await supabase
      .from('car_clubs')
      .select('id, owner_id')
      .eq('slug', slug)
      .maybeSingle()

    if (!club) {
      return NextResponse.json({ error: '找不到此車友會' }, { status: 404 })
    }
    // 早一步擋掉非 owner（DB 層也會擋；這裡先 fail-fast）
    if (club.owner_id !== userId) {
      return NextResponse.json({ error: '只有創辦人可轉讓社團' }, { status: 403 })
    }

    // 呼叫 RPC（atomic：驗證 + 切換 owner_id + 切換雙方 role）
    const { error } = await supabase.rpc('transfer_club_ownership', {
      p_club_id: club.id,
      p_new_owner_id: newOwnerId,
    })

    if (error) {
      // RPC 拋的錯誤訊息可直接給 client（已是中性訊息，不洩漏內部）
      const status =
        error.code === '42501' ? 403 :
        error.code === 'P0002' ? 404 :
        error.code === '22023' ? 400 :
        500
      logger.error('api.clubs.transfer_ownership_fail', error, { slug, userId, newOwnerId })
      return NextResponse.json({ error: error.message || '轉讓失敗' }, { status })
    }

    logger.info('api.clubs.transfer_ownership_ok', { slug, fromUserId: userId, toUserId: newOwnerId })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('api.clubs.transfer_ownership_unexpected', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
