import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { userId } = auth
    const supabase = createServiceClient()

    const { target_type, target_id, reason, details } = await request.json()

    if (!target_type || !target_id || !reason) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const validTypes = ['forum_post', 'forum_reply', 'club_post', 'user', 'comment']
    if (!validTypes.includes(target_type)) {
      return NextResponse.json({ error: '無效的檢舉類型' }, { status: 400 })
    }

    // 檢查是否已有 pending 檢舉（防止重複檢舉）
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', userId)
      .eq('target_type', target_type)
      .eq('target_id', target_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: '你已經檢舉過此內容，我們正在處理中' }, { status: 409 })
    }

    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: userId,
        target_type,
        target_id,
        reason,
        details: details || null,
      })

    if (error) {
      // 處理 unique constraint violation（並發請求）
      if (error.code === '23505') {
        return NextResponse.json({ error: '你已經檢舉過此內容' }, { status: 409 })
      }
      console.error('[Reports POST] Error:', error)
      return NextResponse.json({ error: '檢舉失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '檢舉已送出，我們會儘快處理' })
  } catch (error) {
    console.error('[Reports POST] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
