import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase'

// PATCH: 管理貼文（pin/lock/approve）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminAuth(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const updates: Record<string, unknown> = {}

  if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned
  if (typeof body.is_locked === 'boolean') updates.is_locked = body.is_locked
  if (typeof body.is_approved === 'boolean') updates.is_approved = body.is_approved

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有提供更新欄位' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('forum_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Admin Forum PATCH] Error:', error)
    return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  }

  return NextResponse.json({ post: data })
}

// DELETE: 刪除貼文
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminAuth(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('forum_posts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[Admin Forum DELETE] Error:', error)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
