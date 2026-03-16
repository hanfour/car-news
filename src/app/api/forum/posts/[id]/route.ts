import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createAuthenticatedClient } from '@/lib/auth'
import { moderateComment } from '@/lib/ai/claude'

// GET: 單篇貼文
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: post, error } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('id', id)
      .eq('is_approved', true)
      .single()

    if (error || !post) {
      return NextResponse.json({ error: '找不到此貼文' }, { status: 404 })
    }

    // 增加瀏覽數（atomic increment，避免 race condition）
    const { error: rpcError } = await supabase.rpc('increment_view_count', { post_id: id })
    if (rpcError) {
      // Fallback: 非 atomic 但不影響主要流程
      await supabase.from('forum_posts').update({ view_count: (post.view_count || 0) + 1 }).eq('id', id)
    }

    // 作者 profile
    const { data: author } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', post.user_id)
      .single()

    // 分類
    const { data: category } = await supabase
      .from('forum_categories')
      .select('id, name, slug, icon')
      .eq('id', post.category_id)
      .single()

    // 回覆列表
    const { data: replies } = await supabase
      .from('forum_replies')
      .select('*')
      .eq('post_id', id)
      .eq('is_approved', true)
      .order('created_at', { ascending: true })

    // 回覆作者 profiles
    let repliesWithAuthors = replies || []
    if (replies && replies.length > 0) {
      const replyUserIds = [...new Set(replies.map(r => r.user_id))]
      const { data: replyProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', replyUserIds)

      const profilesMap = new Map(replyProfiles?.map(p => [p.id, p]) || [])
      repliesWithAuthors = replies.map(r => ({
        ...r,
        author: profilesMap.get(r.user_id) || null,
      }))
    }

    return NextResponse.json({
      post: { ...post, author, category },
      replies: repliesWithAuthors,
    })
  } catch (error) {
    console.error('[Forum Post GET] Error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// PATCH: 更新貼文
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const body = await request.json()
    const { title, content, tags, related_brand, related_model } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title) updates.title = title
    if (content) updates.content = content
    if (tags) updates.tags = tags
    if (related_brand !== undefined) updates.related_brand = related_brand
    if (related_model !== undefined) updates.related_model = related_model

    // 內容有修改時重新執行 AI 審核
    if (title || content) {
      const moderationText = [title, content].filter(Boolean).join('\n')
      const moderation = await moderateComment(moderationText)
      if (moderation.confidence > 95 && moderation.flags.length > 0) {
        return NextResponse.json({ error: '內容包含不當內容，無法更新' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('forum_posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 刪除貼文
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
