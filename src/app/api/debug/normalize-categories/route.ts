import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

/**
 * 統一分類術語
 * - 行業 → 產業
 * - 产业 (簡體) → 產業 (繁體)
 * - 其他可能的簡繁混用問題
 */

const CATEGORY_MAPPING: Record<string, string> = {
  '行業': '產業',
  '产业': '產業',
  '行业': '產業',
  '產業': '產業', // 保持不變
  '新车': '新車',
  '新車': '新車', // 保持不變
  '评测': '評測',
  '評測': '評測', // 保持不變
  '电动车': '電動車',
  '電動車': '電動車', // 保持不變
  '科技': '科技', // 保持不變
  '赛车': '賽車',
  '賽車': '賽車', // 保持不變
}

export async function GET() {
  const supabase = createClient()

  // 獲取所有文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, categories')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!articles) {
    return NextResponse.json({ articles: [] })
  }

  const updates = []
  const unchanged = []

  for (const article of articles) {
    if (!article.categories || article.categories.length === 0) {
      continue
    }

    // 標準化分類
    const normalizedCategories = article.categories.map((cat: string) =>
      CATEGORY_MAPPING[cat] || cat
    )

    // 檢查是否有變化
    const hasChanged = normalizedCategories.some((cat: string, idx: number) =>
      cat !== article.categories[idx]
    )

    if (hasChanged) {
      // 更新資料庫
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({ categories: normalizedCategories })
        .eq('id', article.id)

      if (updateError) {
        updates.push({
          id: article.id,
          title: article.title_zh,
          status: 'failed',
          error: updateError.message
        })
      } else {
        updates.push({
          id: article.id,
          title: article.title_zh,
          status: 'success',
          old: article.categories,
          new: normalizedCategories
        })
      }
    } else {
      unchanged.push({
        id: article.id,
        categories: article.categories
      })
    }
  }

  return NextResponse.json({
    total: articles.length,
    updated: updates.filter(u => u.status === 'success').length,
    failed: updates.filter(u => u.status === 'failed').length,
    unchanged: unchanged.length,
    details: {
      updates,
      sampleUnchanged: unchanged.slice(0, 5)
    }
  })
}
