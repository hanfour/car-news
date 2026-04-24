import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyAdminAuth } from '@/lib/admin/auth'

// 共用 verifyAdminAuth（lib/admin/auth.ts）：timing-safe Bearer 比對 + cookie session，
// 取代原本這檔自刻的 verifyAuth + module-level throw 驗證，後者會在 next build
// collecting page data 時爆（因為無真實 ADMIN_API_KEY 長度不夠）
const verifyAuth = verifyAdminAuth

// GET /api/admin/articles/[id] - 獲取單篇文章
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ article: data })
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
  const updates: Record<string, unknown> = {}
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
  try {
    if (!(await verifyAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // 先刪除關聯的圖片記錄（如果有）
    await supabase
      .from('article_images')
      .delete()
      .eq('article_id', id)

    // 再刪除文章
    const { error } = await supabase
      .from('generated_articles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete article error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error('DELETE endpoint error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
