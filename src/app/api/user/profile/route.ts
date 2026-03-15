import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// PATCH: 更新自己的個人檔案
export async function PATCH(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const body = await request.json()
    const allowedFields = ['username', 'display_name', 'bio', 'website', 'location', 'is_favorites_public']
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '沒有要更新的欄位' }, { status: 400 })
    }

    // 驗證 username 格式
    if (updates.username !== undefined) {
      if (updates.username !== null && typeof updates.username === 'string') {
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(updates.username)) {
          return NextResponse.json(
            { error: '用戶名稱只能包含英文字母、數字和底線，長度 3-30 字元' },
            { status: 400 }
          )
        }

        // 檢查唯一性
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', updates.username)
          .neq('id', userId)
          .maybeSingle()

        if (existing) {
          return NextResponse.json({ error: '此用戶名稱已被使用' }, { status: 409 })
        }
      }
    }

    // 驗證 website URL
    if (updates.website && typeof updates.website === 'string') {
      try {
        new URL(updates.website)
      } catch {
        return NextResponse.json({ error: '網站網址格式不正確' }, { status: 400 })
      }
    }

    // 驗證 display_name 長度
    if (updates.display_name && typeof updates.display_name === 'string') {
      if (updates.display_name.length > 50) {
        return NextResponse.json({ error: '顯示名稱不能超過 50 字元' }, { status: 400 })
      }
    }

    // 驗證 bio 長度
    if (updates.bio && typeof updates.bio === 'string') {
      if (updates.bio.length > 300) {
        return NextResponse.json({ error: '自我介紹不能超過 300 字元' }, { status: 400 })
      }
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('[Profile PATCH] Error:', error)
      if (error.code === '23514') {
        return NextResponse.json({ error: '用戶名稱格式不正確' }, { status: 400 })
      }
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error('[Profile PATCH] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
