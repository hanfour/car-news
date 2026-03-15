import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'

// POST: 上傳頭像
export async function POST(request: NextRequest) {
  try {
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
    }

    // 驗證檔案類型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '僅支援 JPG、PNG、WebP 格式' }, { status: 400 })
    }

    // 驗證大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '檔案大小不能超過 5MB' }, { status: 400 })
    }

    // 上傳到 Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg'
    const filePath = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) {
      console.error('[Avatar Upload] Error:', uploadError)
      return NextResponse.json({ error: '上傳失敗' }, { status: 500 })
    }

    // 取得公開 URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    // 更新 profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Avatar Upload] Profile update error:', updateError)
      return NextResponse.json({ error: '更新頭像失敗' }, { status: 500 })
    }

    return NextResponse.json({ avatar_url: publicUrl })
  } catch (error) {
    console.error('[Avatar Upload] Unexpected error:', error)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
