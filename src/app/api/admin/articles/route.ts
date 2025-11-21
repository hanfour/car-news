import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'

// Secure API Key validation - no insecure defaults allowed
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

if (!ADMIN_API_KEY || ADMIN_API_KEY === 'admin-secret-key-change-me' || ADMIN_API_KEY.length < 20) {
  throw new Error(
    '❌ ADMIN_API_KEY must be set to a secure value (at least 20 characters).\n' +
    'Current value is either missing or insecure.\n' +
    'Generate a secure key with: openssl rand -hex 32'
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

// GET /api/admin/articles - 列出所有文章
export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const searchParams = request.nextUrl.searchParams

  // 篩選參數
  const published = searchParams.get('published') // 'true' | 'false' | null (all)
  const brand = searchParams.get('brand')
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  let query = supabase
    .from('generated_articles')
    .select('id, title_zh, published, published_at, created_at, confidence, primary_brand, categories, view_count', { count: 'exact' })
    .order('created_at', { ascending: false })

  // 應用篩選
  if (published !== null) {
    query = query.eq('published', published === 'true')
  }

  if (brand) {
    query = query.eq('primary_brand', brand)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    articles: data,
    total: count,
    limit,
    offset
  })
}
