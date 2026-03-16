import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET: 公開個人檔案
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = createClient()

    // 支援 username 或 user ID 查詢
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)

    let query = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, website, location, cover_image_url, is_favorites_public, followers_count, following_count, created_at')

    if (isUuid) {
      query = query.eq('id', username)
    } else {
      query = query.eq('username', username)
    }

    const { data: profile, error } = await query.single()

    if (error || !profile) {
      return NextResponse.json({ error: '找不到此使用者' }, { status: 404 })
    }

    // 取得評論數
    const { count: commentsCount } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_approved', true)

    return NextResponse.json({
      profile: {
        ...profile,
        comments_count: commentsCount || 0,
      },
    })
  } catch (error) {
    console.error('[User Profile GET] Error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
