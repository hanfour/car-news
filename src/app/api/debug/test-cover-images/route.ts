import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyDebugAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
  const access = await verifyDebugAccess(request)
  if (!access.allowed) return access.response!

  const supabase = createClient()

  // 測試分類查詢
  const { data: categoryData, error: categoryError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, categories')
    .eq('published', true)
    .contains('categories', ['新車'])
    .limit(5)

  // 測試首頁查詢
  const { data: homeData, error: homeError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    category: {
      error: categoryError,
      count: categoryData?.length || 0,
      articlesWithCover: categoryData?.filter(a => a.cover_image).length || 0,
      samples: categoryData?.slice(0, 3).map(a => ({
        title: a.title_zh.substring(0, 50),
        hasCover: !!a.cover_image,
        coverUrl: a.cover_image ? a.cover_image.substring(0, 80) : null
      }))
    },
    home: {
      error: homeError,
      count: homeData?.length || 0,
      articlesWithCover: homeData?.filter(a => a.cover_image).length || 0,
      samples: homeData?.slice(0, 3).map(a => ({
        title: a.title_zh.substring(0, 50),
        hasCover: !!a.cover_image,
        coverUrl: a.cover_image ? a.cover_image.substring(0, 80) : null
      }))
    }
  })
}
