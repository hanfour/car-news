#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

/**
 * 修復最嚴重的封面圖問題（0-10KB）
 */

const CRITICAL_THRESHOLD = 10 * 1024 // 10KB

async function fixCriticalCovers() {
  const supabase = createServiceClient()

  console.log('🚨 修復嚴重問題的封面圖...\n')
  console.log(`標準: 封面圖 < ${CRITICAL_THRESHOLD / 1024} KB（0 KB 或極小）\n`)

  // 獲取所有已發布的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, images, brands, content_zh')
    .eq('published', true)
    .not('cover_image', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !articles) {
    console.error('❌ 查詢失敗:', error)
    return
  }

  console.log(`📊 檢查 ${articles.length} 篇文章...\n`)

  const criticalArticles: Array<{
    id: string
    title_zh: string
    cover_image: string
    size: number
    images?: any[]
    brands?: string[]
    content_zh?: string
  }> = []

  // 檢查每篇文章的封面圖大小
  for (const article of articles) {
    try {
      const response = await fetch(article.cover_image, { method: 'HEAD' })
      const size = parseInt(response.headers.get('content-length') || '0')

      if (size < CRITICAL_THRESHOLD) {
        criticalArticles.push({
          id: article.id,
          title_zh: article.title_zh,
          cover_image: article.cover_image,
          size,
          images: article.images,
          brands: article.brands,
          content_zh: article.content_zh
        })

        const sizeDesc = size === 0 ? '0 KB (失效)' : `${(size / 1024).toFixed(1)} KB`
        console.log(`🚨 ${article.id} - ${sizeDesc} - ${article.title_zh.slice(0, 60)}`)
      }
    } catch (e) {
      console.log(`❌ ${article.id} - 檢查失敗 - ${article.title_zh.slice(0, 60)}`)
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n📈 統計:`)
  console.log(`   總文章數: ${articles.length}`)
  console.log(`   嚴重問題: ${criticalArticles.length} 篇`)
  console.log(`   比例: ${((criticalArticles.length / articles.length) * 100).toFixed(1)}%`)

  if (criticalArticles.length === 0) {
    console.log(`\n✅ 沒有嚴重問題的封面圖！`)
    return
  }

  console.log(`\n\n${'='.repeat(80)}`)
  console.log(`\n🔧 開始修復 ${criticalArticles.length} 篇文章...\n`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < criticalArticles.length; i++) {
    const article = criticalArticles[i]

    console.log(`\n[${ i + 1}/${criticalArticles.length}] ${'─'.repeat(70)}`)
    console.log(`${article.id} - ${article.title_zh}`)
    console.log(`當前: ${article.size === 0 ? '0 KB (失效)' : (article.size / 1024).toFixed(1) + ' KB'}`)
    console.log(`${'─'.repeat(80)}\n`)

    try {
      // 準備參考圖片
      const referenceImages: Array<{ url: string; caption?: string; size?: number }> = []

      if (article.images && article.images.length > 0) {
        console.log(`→ 檢查參考圖片...`)
        for (const img of article.images) {
          try {
            const res = await fetch(img.url, { method: 'HEAD' })
            const imgSize = parseInt(res.headers.get('content-length') || '0')

            if (imgSize > 10000) {
              referenceImages.push({
                url: img.url,
                caption: img.caption,
                size: imgSize
              })
              console.log(`   ✓ ${(imgSize / 1024).toFixed(1)} KB`)
            }
          } catch (e) {
            // Skip
          }
        }
      }

      if (referenceImages.length > 0) {
        console.log(`   ✓ 找到 ${referenceImages.length} 張參考圖片`)
      } else {
        console.log(`   ⚠ 無參考圖片，將使用文字生成`)
      }

      // 生成新封面
      console.log(`\n→ 生成新封面圖...`)
      const aiImage = await generateAndSaveCoverImage(
        article.title_zh,
        article.content_zh || '',
        article.brands,
        referenceImages
      )

      if (!aiImage || !aiImage.url) {
        console.error(`❌ 生成失敗\n`)
        failCount++
        continue
      }

      // 更新資料庫
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({
          cover_image: aiImage.url,
          image_credit: aiImage.credit
        })
        .eq('id', article.id)

      if (updateError) {
        console.error(`❌ 更新失敗:`, updateError)
        failCount++
        continue
      }

      // 驗證新圖片大小
      const newResponse = await fetch(aiImage.url)
      const newBlob = await newResponse.blob()
      const newSize = newBlob.size

      console.log(`\n✅ 成功！`)
      console.log(`   前: ${article.size} bytes (${article.size === 0 ? '失效' : (article.size / 1024).toFixed(1) + ' KB'})`)
      console.log(`   後: ${newSize} bytes (${(newSize / 1024).toFixed(1)} KB)`)
      console.log(`   提升: ${((newSize - article.size) / 1024).toFixed(1)} KB`)
      successCount++

    } catch (error: any) {
      console.error(`\n❌ 錯誤:`, error.message)
      failCount++
    }

    // 避免 API rate limit
    if (i < criticalArticles.length - 1) {
      console.log(`\n⏳ 等待 3 秒避免 API rate limit...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n🎉 修復完成！`)
  console.log(`   ✅ 成功: ${successCount} 篇`)
  console.log(`   ❌ 失敗: ${failCount} 篇`)
  console.log(`   📊 總計: ${criticalArticles.length} 篇`)
  console.log(`   成功率: ${((successCount / criticalArticles.length) * 100).toFixed(1)}%`)
  console.log('')
}

fixCriticalCovers().catch(console.error)
