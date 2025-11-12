import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * 修復資料庫中包含 HTML 實體編碼的圖片 URL
 *
 * 問題：RSS feed 中的圖片 URL 包含 &#038; 而不是 &
 * 導致 Next.js Image Optimization 返回 400 錯誤
 *
 * 修復：
 * 1. 查詢所有包含 &#038; 的圖片 URL
 * 2. 解碼 HTML 實體
 * 3. 更新資料庫
 */
export async function POST() {
  const supabase = createServiceClient()

  try {
    // 解碼 HTML 實體的函數
    function decodeHtmlEntities(url: string): string {
      return url
        .replace(/&#038;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
    }

    const results = {
      rawArticles: { checked: 0, fixed: 0, errors: [] as string[] },
      generatedArticles: { checked: 0, fixed: 0, errors: [] as string[] }
    }

    // 1. 修復 raw_articles 表
    const { data: rawArticles, error: rawError } = await supabase
      .from('raw_articles')
      .select('id, image_url')
      .not('image_url', 'is', null)

    if (rawError) {
      throw new Error(`Failed to fetch raw_articles: ${rawError.message}`)
    }

    results.rawArticles.checked = rawArticles?.length || 0

    for (const article of rawArticles || []) {
      if (article.image_url && article.image_url.includes('&#038;')) {
        const fixedUrl = decodeHtmlEntities(article.image_url)

        const { error: updateError } = await supabase
          .from('raw_articles')
          .update({ image_url: fixedUrl })
          .eq('id', article.id)

        if (updateError) {
          results.rawArticles.errors.push(`${article.id}: ${updateError.message}`)
        } else {
          results.rawArticles.fixed++
        }
      }
    }

    // 2. 修復 generated_articles 表的 cover_image
    const { data: genArticles, error: genError } = await supabase
      .from('generated_articles')
      .select('id, cover_image, images')
      .not('cover_image', 'is', null)

    if (genError) {
      throw new Error(`Failed to fetch generated_articles: ${genError.message}`)
    }

    results.generatedArticles.checked = genArticles?.length || 0

    for (const article of genArticles || []) {
      let needsUpdate = false
      let fixedCoverImage = article.cover_image
      let fixedImages = article.images

      // 修復 cover_image
      if (article.cover_image && article.cover_image.includes('&#038;')) {
        fixedCoverImage = decodeHtmlEntities(article.cover_image)
        needsUpdate = true
      }

      // 修復 images 陣列中的 URL
      if (Array.isArray(article.images) && article.images.length > 0) {
        fixedImages = article.images.map((img: any) => {
          if (img.url && img.url.includes('&#038;')) {
            needsUpdate = true
            return {
              ...img,
              url: decodeHtmlEntities(img.url)
            }
          }
          return img
        })
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('generated_articles')
          .update({
            cover_image: fixedCoverImage,
            images: fixedImages
          })
          .eq('id', article.id)

        if (updateError) {
          results.generatedArticles.errors.push(`${article.id}: ${updateError.message}`)
        } else {
          results.generatedArticles.fixed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        raw_articles: `Fixed ${results.rawArticles.fixed} of ${results.rawArticles.checked} articles`,
        generated_articles: `Fixed ${results.generatedArticles.fixed} of ${results.generatedArticles.checked} articles`,
        total_errors: results.rawArticles.errors.length + results.generatedArticles.errors.length
      }
    })

  } catch (error: any) {
    console.error('Fix image URLs error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
