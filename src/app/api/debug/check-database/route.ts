import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyDebugAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
  const access = await verifyDebugAccess(request)
  if (!access.allowed) return access.response!

  const supabase = createClient()

  // 檢查所有已發布文章的封面圖片狀態
  const { data: allArticles, error: allError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, categories, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })

  const total = allArticles?.length || 0
  const withCover = allArticles?.filter(a => a.cover_image).length || 0
  const withoutCover = total - withCover

  // 檢查「新車」分類的文章
  const newCarArticles = allArticles?.filter(a =>
    a.categories?.includes('新車')
  ) || []
  const newCarWithCover = newCarArticles.filter(a => a.cover_image).length

  return NextResponse.json({
    summary: {
      total,
      withCover,
      withoutCover,
      coverageRate: total > 0 ? ((withCover / total) * 100).toFixed(1) + '%' : '0%'
    },
    newCarCategory: {
      total: newCarArticles.length,
      withCover: newCarWithCover,
      withoutCover: newCarArticles.length - newCarWithCover,
      coverageRate: newCarArticles.length > 0 ? ((newCarWithCover / newCarArticles.length) * 100).toFixed(1) + '%' : '0%'
    },
    recentArticlesWithoutCover: allArticles
      ?.filter(a => !a.cover_image)
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title_zh.substring(0, 50),
        published: a.published_at,
        categories: a.categories
      })),
    error: allError
  })
}
