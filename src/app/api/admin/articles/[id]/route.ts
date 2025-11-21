import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'

// Secure authentication - no unsafe defaults
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

if (!ADMIN_API_KEY || ADMIN_API_KEY === 'admin-secret-key-change-me' || ADMIN_API_KEY.length < 20) {
  throw new Error(
    '❌ ADMIN_API_KEY must be set to a secure value (at least 20 characters).\n' +
    'Generate with: openssl rand -hex 32'
  )
}

async function verifyAuth(request: NextRequest): Promise<boolean> {
  // 方式 1: Bearer token (用於 API 調用)
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${ADMIN_API_KEY}`) {
    return true
  }

  // 方式 2: Cookie session (用於 Web UI)
  const sessionCookie = request.cookies.get('admin_session')
  if (sessionCookie?.value) {
    // 驗證 session token 並獲取 userId
    const userId = await verifySessionToken(sessionCookie.value)
    if (!userId) {
      return false
    }

    // 驗證這個 userId 確實是 admin
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    return data?.is_admin === true
  }

  return false
}

// PATCH /api/admin/articles/[id] - 更新文章
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const supabase = createServiceClient()

  // 允許更新的欄位白名單
  const allowedFields = [
    'title_zh',
    'content_zh',
    'published',
    'categories',
    'tags',
    'brands',
    'car_models',
    'cover_image',
    'human_rating',  // 1-5 評分
  ]

  // 過濾出允許的欄位
  const updates: any = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  // 如果更改 published 狀態,更新 published_at
  if ('published' in updates) {
    if (updates.published) {
      updates.published_at = new Date().toISOString().split('T')[0]
    } else {
      updates.published_at = null
    }
  }

  const { data, error } = await supabase
    .from('generated_articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ article: data })
}

// DELETE /api/admin/articles/[id] - 刪除文章
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('generated_articles')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: id })
}
