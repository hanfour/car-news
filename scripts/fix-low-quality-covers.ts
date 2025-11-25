#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

/**
 * 批量檢查並修復低質量封面圖
 * 標準：< 50KB 視為低質量，需要重新生成
 */

const SIZE_THRESHOLD = 50 * 1024 // 50KB

async function findLowQualityCovers(dryRun: boolean = true) {
  const supabase = createServiceClient()

  console.log('🔍 檢查低質量封面圖...\n')
  console.log(`標準: 封面圖 < ${SIZE_THRESHOLD / 1024} KB\n`)

  // 獲取所有已發布的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, images, brands, content_zh, published')
    .eq('published', true)
    .not('cover_image', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200) // 檢查最近 200 篇

  if (error || !articles) {
    console.error('❌ 查詢失敗:', error)
    return
  }

  console.log(`📊 檢查 ${articles.length} 篇文章的封面圖...\n`)

  const lowQualityArticles: Array<{
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

      if (size < SIZE_THRESHOLD) {
        lowQualityArticles.push({
          id: article.id,
          title_zh: article.title_zh,
          cover_image: article.cover_image,
          size,
          images: article.images,
          brands: article.brands,
          content_zh: article.content_zh
        })

        console.log(`⚠️  ${article.id} - ${(size / 1024).toFixed(1)} KB - ${article.title_zh.slice(0, 50)}`)
      }
    } catch (e) {
      console.log(`❌ ${article.id} - Failed to check - ${article.title_zh.slice(0, 50)}`)
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n📈 統計:`)
  console.log(`   總文章數: ${articles.length}`)
  console.log(`   低質量封面: ${lowQualityArticles.length} 篇`)
  console.log(`   比例: ${((lowQualityArticles.length / articles.length) * 100).toFixed(1)}%`)

  if (lowQualityArticles.length === 0) {
    console.log(`\n✅ 所有封面圖質量良好！`)
    return
  }

  // 顯示詳細列表
  console.log(`\n\n需要重新生成的文章列表:`)
  console.log(`${'='.repeat(80)}\n`)

  lowQualityArticles.forEach((article, index) => {
    console.log(`${index + 1}. ${article.id}`)
    console.log(`   標題: ${article.title_zh}`)
    console.log(`   當前封面大小: ${(article.size / 1024).toFixed(1)} KB`)
    console.log(`   參考圖片數量: ${article.images?.length || 0}`)
    console.log(`   URL: https://wantcar.autos/2025/11/${article.id}`)
    console.log('')
  })

  if (dryRun) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n⚠️  這是 DRY RUN 模式，不會實際修復`)
    console.log(`\n執行修復請使用: npx tsx scripts/fix-low-quality-covers.ts --fix`)
    console.log(`或修復特定文章: npx tsx scripts/fix-low-quality-covers.ts --fix <article_id>`)
    return
  }

  // 實際修復
  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n🔧 開始修復 ${lowQualityArticles.length} 篇文章...\n`)

  let successCount = 0
  let failCount = 0

  for (const article of lowQualityArticles) {
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`處理: ${article.id} - ${article.title_zh}`)
    console.log(`${'─'.repeat(80)}\n`)

    try {
      // 準備參考圖片
      const referenceImages: Array<{ url: string; caption?: string; size?: number }> = []

      if (article.images && article.images.length > 0) {
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
            }
          } catch (e) {
            // Skip
          }
        }
      }

      console.log(`   參考圖片: ${referenceImages.length} 張可用`)

      // 生成新封面
      const aiImage = await generateAndSaveCoverImage(
        article.title_zh,
        article.content_zh || '',
        article.brands,
        referenceImages
      )

      if (!aiImage || !aiImage.url) {
        console.error(`   ❌ 生成失敗`)
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
        console.error(`   ❌ 更新失敗:`, updateError)
        failCount++
        continue
      }

      // 驗證新圖片大小
      const newResponse = await fetch(aiImage.url)
      const newBlob = await newResponse.blob()
      const newSize = newBlob.size

      console.log(`   ✅ 成功！ ${(article.size / 1024).toFixed(1)} KB → ${(newSize / 1024).toFixed(1)} KB`)
      successCount++

    } catch (error: any) {
      console.error(`   ❌ 錯誤:`, error.message)
      failCount++
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n🎉 修復完成！`)
  console.log(`   ✅ 成功: ${successCount} 篇`)
  console.log(`   ❌ 失敗: ${failCount} 篇`)
  console.log(`   📊 總計: ${lowQualityArticles.length} 篇`)
  console.log('')
}

// 執行
const args = process.argv.slice(2)
const dryRun = !args.includes('--fix')
const specificArticle = args.find(arg => !arg.startsWith('--'))

if (specificArticle) {
  console.log(`修復特定文章: ${specificArticle}`)
  console.log('功能開發中...')
  process.exit(0)
}

findLowQualityCovers(dryRun).catch(console.error)
