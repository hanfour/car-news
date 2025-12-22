import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyDebugAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
  const access = await verifyDebugAccess(request)
  if (!access.allowed) return access.response!

  const supabase = createClient()

  try {
    // 測試查詢 generated_articles 的 source_date 欄位
    const { data: articles, error: articlesError } = await supabase
      .from('generated_articles')
      .select('id, title_zh, published_at, source_date, created_at')
      .limit(3)

    // 測試查詢 raw_articles 的 published_at 欄位
    const { data: rawArticles, error: rawError } = await supabase
      .from('raw_articles')
      .select('id, title, published_at, scraped_at')
      .limit(3)

    return NextResponse.json({
      success: true,
      generated_articles: {
        error: articlesError,
        sample: articles?.map(a => ({
          id: a.id,
          title: a.title_zh?.substring(0, 30),
          published_at: a.published_at,
          source_date: a.source_date,
          created_at: a.created_at
        }))
      },
      raw_articles: {
        error: rawError,
        sample: rawArticles?.map(a => ({
          id: a.id,
          title: a.title?.substring(0, 30),
          published_at: a.published_at,
          scraped_at: a.scraped_at
        }))
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
