import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyDebugAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
  const access = await verifyDebugAccess(request)
  if (!access.allowed) return access.response!

  const supabase = createClient()

  // 首頁查詢（按 published_at 排序）
  const { data: homeArticles, error: homeError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, images, categories')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(5)

  // 分類頁面查詢（新車分類）
  const { data: categoryArticles, error: categoryError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, images, categories')
    .eq('published', true)
    .contains('categories', ['新車'])
    .order('published_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    home: {
      error: homeError,
      articles: homeArticles?.map(a => ({
        id: a.id,
        title: a.title_zh?.substring(0, 40),
        hasCoverImage: !!a.cover_image,
        coverImageUrl: a.cover_image?.substring(0, 80),
        hasImages: Array.isArray(a.images) && a.images.length > 0,
        imagesCount: Array.isArray(a.images) ? a.images.length : 0,
        categories: a.categories
      }))
    },
    category: {
      error: categoryError,
      articles: categoryArticles?.map(a => ({
        id: a.id,
        title: a.title_zh?.substring(0, 40),
        hasCoverImage: !!a.cover_image,
        coverImageUrl: a.cover_image?.substring(0, 80),
        hasImages: Array.isArray(a.images) && a.images.length > 0,
        imagesCount: Array.isArray(a.images) ? a.images.length : 0,
        categories: a.categories
      }))
    }
  })
}
