import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth'
import { uploadToR2, deleteFromR2 } from '@/lib/storage/r2-client'
import { getErrorMessage } from '@/lib/utils/error'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_GALLERY = 10

// POST: 上傳車庫圖片到 R2
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: carId } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const rl = rateLimit(`garage-image:${userId}`, { maxRequests: 20, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
    }

    // 驗證車輛所有權
    const { data: car, error: carError } = await supabase
      .from('user_cars')
      .select('id, cover_image, images')
      .eq('id', carId)
      .eq('user_id', userId)
      .single()

    if (carError || !car) {
      return NextResponse.json({ error: '找不到此車輛或無權操作' }, { status: 404 })
    }

    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const type = formData.get('type') as string // 'cover' | 'gallery'

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: '請選擇圖片' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return NextResponse.json({ error: '僅支援 JPG、PNG、WebP 格式' }, { status: 400 })
    }

    if (image.size > MAX_SIZE) {
      return NextResponse.json({ error: '檔案大小不能超過 5MB' }, { status: 400 })
    }

    if (type !== 'cover' && type !== 'gallery') {
      return NextResponse.json({ error: '無效的圖片類型' }, { status: 400 })
    }

    // Gallery 上限檢查
    const currentImages: string[] = car.images || []
    if (type === 'gallery' && currentImages.length >= MAX_GALLERY) {
      return NextResponse.json({ error: `相簿最多 ${MAX_GALLERY} 張圖片` }, { status: 400 })
    }

    // 讀取檔案並轉換為 WebP
    const arrayBuffer = await image.arrayBuffer()
    const inputBuffer = Buffer.from(new Uint8Array(arrayBuffer))

    const sharp = (await import('sharp')).default
    const buffer = await sharp(inputBuffer)
      .resize(1792, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toBuffer()

    // 上傳到 R2
    const key = `garage/${userId}/${carId}/${Date.now()}.webp`
    const publicUrl = await uploadToR2(key, buffer, 'image/webp')

    // 更新資料庫
    if (type === 'cover') {
      const { error: updateError } = await supabase
        .from('user_cars')
        .update({ cover_image: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', carId)
        .eq('user_id', userId)

      if (updateError) {
        return NextResponse.json({ error: '更新失敗' }, { status: 500 })
      }
    } else {
      // Re-read images to avoid race condition with concurrent uploads
      const { data: freshCar } = await supabase
        .from('user_cars')
        .select('images')
        .eq('id', carId)
        .eq('user_id', userId)
        .single()

      const freshImages: string[] = freshCar?.images || []
      if (freshImages.length >= MAX_GALLERY) {
        return NextResponse.json({ error: `相簿最多 ${MAX_GALLERY} 張圖片` }, { status: 400 })
      }

      const newImages = [...freshImages, publicUrl]
      const { error: updateError } = await supabase
        .from('user_cars')
        .update({ images: newImages, updated_at: new Date().toISOString() })
        .eq('id', carId)
        .eq('user_id', userId)

      if (updateError) {
        return NextResponse.json({ error: '更新失敗' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, url: publicUrl, type })
  } catch (error) {
    logger.error('api.garage.image_upload_fail', error, { message: getErrorMessage(error) })
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}

// DELETE: 刪除車庫圖片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: carId } = await params
    const auth = await createAuthenticatedClient(request)
    if (!auth) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const { supabase, userId } = auth

    const { url, type } = await request.json()
    if (!url || !type) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 驗證車輛所有權
    const { data: car, error: carError } = await supabase
      .from('user_cars')
      .select('id, cover_image, images')
      .eq('id', carId)
      .eq('user_id', userId)
      .single()

    if (carError || !car) {
      return NextResponse.json({ error: '找不到此車輛或無權操作' }, { status: 404 })
    }

    // 驗證 URL 確實屬於此車輛的圖片
    if (type === 'cover' && car.cover_image !== url) {
      return NextResponse.json({ error: '此圖片不屬於該車輛' }, { status: 403 })
    }
    if (type === 'gallery' && !(car.images || []).includes(url)) {
      return NextResponse.json({ error: '此圖片不屬於該車輛' }, { status: 403 })
    }

    // 從 R2 刪除 — 從 URL 提取 key（R2_PUBLIC_URL 後面的部分）
    const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')
    if (r2PublicUrl && url.startsWith(r2PublicUrl)) {
      const key = url.slice(r2PublicUrl.length + 1)
      await deleteFromR2(key)
    }

    // 更新資料庫
    if (type === 'cover') {
      await supabase
        .from('user_cars')
        .update({ cover_image: null, updated_at: new Date().toISOString() })
        .eq('id', carId)
        .eq('user_id', userId)
    } else {
      const currentImages: string[] = car.images || []
      const newImages = currentImages.filter(img => img !== url)
      await supabase
        .from('user_cars')
        .update({ images: newImages, updated_at: new Date().toISOString() })
        .eq('id', carId)
        .eq('user_id', userId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('api.garage.image_delete_fail', error, { message: getErrorMessage(error) })
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
