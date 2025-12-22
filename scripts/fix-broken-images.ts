/**
 * 修復已生成文章中的損壞圖片
 *
 * 問題：某些外部圖片（如 Toyota S3）有 hotlink protection，
 *      在圖片下載失敗時使用了原 URL 作為 fallback，
 *      導致用戶端也無法訪問（403 Forbidden）
 *
 * 解決：移除無法訪問的圖片 URL
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface StoredImage {
  url: string
  credit: string
  caption?: string
  originalUrl?: string
}

/**
 * 檢查圖片是否可訪問
 */
async function isImageAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)',
      },
      signal: AbortSignal.timeout(10000), // 10秒超時
    })

    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * 檢查是否為外部圖片（非 Supabase Storage）
 */
function isExternalImage(url: string): boolean {
  try {
    const urlObj = new URL(url)
    // Supabase Storage 的圖片都在我們自己的 domain
    return !urlObj.hostname.includes('supabase')
  } catch {
    return false
  }
}

async function fixBrokenImages() {
  console.log('\n🔧 修復損壞的圖片...\n')

  // 獲取所有已發布的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, images, cover_image')
    .eq('published', true)

  if (error) {
    console.error('❌ 查詢失敗：', error)
    return
  }

  console.log(`找到 ${articles?.length || 0} 篇已發布文章\n`)

  let totalArticles = 0
  let articlesFixed = 0
  let imagesRemoved = 0

  for (const article of articles || []) {
    totalArticles++

    let needsUpdate = false
    const updatedImages: StoredImage[] = []
    let updatedCoverImage = article.cover_image

    // 檢查文章圖片
    if (article.images && Array.isArray(article.images)) {
      console.log(`\n📄 ${article.title_zh.substring(0, 50)}`)
      console.log(`   原始圖片數量: ${article.images.length}`)

      for (const image of article.images as StoredImage[]) {
        // 只檢查外部圖片
        if (isExternalImage(image.url)) {
          const accessible = await isImageAccessible(image.url)

          if (accessible) {
            console.log(`   ✅ 可訪問: ${image.url.substring(0, 60)}...`)
            updatedImages.push(image)
          } else {
            console.log(`   ❌ 無法訪問（移除）: ${image.url.substring(0, 60)}...`)
            needsUpdate = true
            imagesRemoved++
          }
        } else {
          // Supabase Storage 的圖片保留
          updatedImages.push(image)
        }

        // 避免太頻繁請求
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`   修正後圖片數量: ${updatedImages.length}`)
    }

    // 檢查封面圖
    if (article.cover_image && isExternalImage(article.cover_image)) {
      const accessible = await isImageAccessible(article.cover_image)

      if (!accessible) {
        console.log(`   ❌ 封面圖無法訪問（移除）: ${article.cover_image.substring(0, 60)}...`)
        updatedCoverImage = null
        needsUpdate = true
        imagesRemoved++
      }
    }

    // 更新文章
    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({
          images: updatedImages,
          cover_image: updatedCoverImage,
        })
        .eq('id', article.id)

      if (updateError) {
        console.log(`   ❌ 更新失敗：${updateError.message}`)
      } else {
        console.log(`   ✅ 已更新`)
        articlesFixed++
      }
    }
  }

  console.log(`\n✅ 完成！`)
  console.log(`   檢查文章：${totalArticles} 篇`)
  console.log(`   修復文章：${articlesFixed} 篇`)
  console.log(`   移除圖片：${imagesRemoved} 張\n`)
}

fixBrokenImages()
