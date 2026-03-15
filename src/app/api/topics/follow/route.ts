import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// POST: 追蹤主題
export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { topic_type, topic_value } = await request.json()

    if (!topic_type || !topic_value) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    if (!['brand', 'car_model', 'category'].includes(topic_type)) {
      return NextResponse.json({ error: '無效的主題類型' }, { status: 400 })
    }

    // Toggle
    const { data: existing } = await supabase
      .from('topic_follows')
      .select('id')
      .eq('user_id', userId)
      .eq('topic_type', topic_type)
      .eq('topic_value', topic_value)
      .maybeSingle()

    if (existing) {
      await supabase.from('topic_follows').delete().eq('id', existing.id)
      return NextResponse.json({ isFollowing: false })
    } else {
      await supabase.from('topic_follows').insert({
        user_id: userId,
        topic_type,
        topic_value,
      })
      return NextResponse.json({ isFollowing: true })
    }
  } catch (error) {
    console.error('[Topic Follow] Error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// GET: 取得使用者的主題追蹤列表
export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { data, error } = await supabase
      .from('topic_follows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({ topics: data || [] })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 取消追蹤主題
export async function DELETE(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { topic_type, topic_value } = await request.json()

    const { error } = await supabase
      .from('topic_follows')
      .delete()
      .eq('user_id', userId)
      .eq('topic_type', topic_type)
      .eq('topic_value', topic_value)

    if (error) {
      return NextResponse.json({ error: '操作失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
