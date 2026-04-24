import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function isConversationParticipant(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// GET: 訊息列表（分頁）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }
    if (!(await isConversationParticipant(supabase, id, userId))) {
      return NextResponse.json({ error: '無權存取此對話' }, { status: 403 })
    }
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const before = searchParams.get('before') // cursor for pagination

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // Fetch sender profiles
    if (messages && messages.length > 0) {
      const serviceClient = auth.getServiceClient()
      const senderIds = [...new Set(messages.map(m => m.sender_id))]
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', senderIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])
      const enriched = messages.map(msg => ({
        ...msg,
        sender: profilesMap.get(msg.sender_id) || null,
        content: msg.is_deleted ? '此訊息已刪除' : msg.content,
      }))

      return NextResponse.json({
        messages: enriched.reverse(), // chronological order
        has_more: messages.length === limit,
      })
    }

    return NextResponse.json({ messages: [], has_more: false })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// POST: 發送訊息
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }
    if (!(await isConversationParticipant(supabase, id, userId))) {
      return NextResponse.json({ error: '無權存取此對話' }, { status: 403 })
    }

    const rl = rateLimit(`dm-send:${userId}`, { maxRequests: 30, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁' }, { status: 429 })
    }

    const { content } = await request.json()
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: '訊息不能為空' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: '訊息過長（最多5000字）' }, { status: 400 })
    }

    // RLS 確保只有參與者可發送（INSERT policy 會檢查）
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: userId,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) {
      logger.error('api.messages.send_fail', error, { conversationId: id, userId })
      return NextResponse.json({ error: '發送失敗' }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (err) {
    logger.error('api.messages.send_unexpected', err)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 刪除訊息（軟刪除，僅發送者可操作）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }
    if (!(await isConversationParticipant(supabase, id, userId))) {
      return NextResponse.json({ error: '無權存取此對話' }, { status: 403 })
    }

    const { message_id } = await request.json()
    if (!message_id || !UUID_RE.test(message_id)) {
      return NextResponse.json({ error: '無效的訊息 ID' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', message_id)
      .eq('conversation_id', id)
      .eq('sender_id', userId)
      .eq('is_deleted', false)
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '刪除失敗' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('api.messages.delete_unexpected', err)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
