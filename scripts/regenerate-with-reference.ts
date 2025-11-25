#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

/**
 * 使用參考圖片重新生成封面圖（圖生圖模式）
 */
async function regenerateWithReference(articleIds: string[]) {
  const supabase = createServiceClient()

  console.log(`🎨 使用參考圖片為 ${articleIds.length} 篇文章重新生成封面圖...\n`)

  for (const articleId of articleIds) {
    console.log('='.repeat(80))
    console.log(`\n處理文章: ${articleId}\n`)

    // 1. 獲取文章內容和圖片
    const { data: article, error: fetchError } = await supabase
      .from('generated_articles')
      .select('id, title_zh, content_zh, brands, cover_image, images')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      console.error(`❌ 無法獲取文章:`, fetchError)
      continue
    }

    console.log('📄 文章信息:')
    console.log('   ID:', article.id)
    console.log('   標題:', article.title_zh)
    console.log('   品牌:', article.brands?.join(', ') || 'N/A')
    console.log('   當前封面:', article.cover_image)
    console.log('   參考圖片數量:', article.images?.length || 0)

    // 檢查並準備參考圖片
    const referenceImages: Array<{ url: string; caption?: string; size?: number }> = []

    if (article.images && article.images.length > 0) {
      console.log('\n→ 檢查參考圖片質量...')

      for (const img of article.images) {
        try {
          const response = await fetch(img.url, { method: 'HEAD' })
          const size = parseInt(response.headers.get('content-length') || '0')

          if (size > 10000) { // 過濾掉小於 10KB 的縮圖
            referenceImages.push({
              url: img.url,
              caption: img.caption,
              size
            })
            console.log(`   ✓ ${(size / 1024).toFixed(1)} KB - ${img.caption || 'No caption'}`)
          } else {
            console.log(`   ✗ ${size} bytes (too small) - ${img.caption || 'No caption'}`)
          }
        } catch (e) {
          console.log(`   ✗ Failed to check: ${img.url}`)
        }
      }
    }

    if (referenceImages.length === 0) {
      console.log('\n⚠️  沒有可用的參考圖片，將使用純文字生成')
    } else {
      console.log(`\n✓ 找到 ${referenceImages.length} 張可用參考圖片`)
    }

    // 2. 生成封面圖（會自動選擇最佳策略）
    console.log(`\n🤖 開始生成封面圖...`)
    console.log('   策略: ' + (referenceImages.length > 0 ? '圖生圖 (DALL-E 2) → Fallback to 文字生成 (DALL-E 3)' : '文字生成 (DALL-E 3)'))
    console.log('   (這可能需要 15-45 秒)\n')

    const aiImage = await generateAndSaveCoverImage(
      article.title_zh,
      article.content_zh,
      article.brands,
      referenceImages // 傳入參考圖片
    )

    if (!aiImage || !aiImage.url) {
      console.error('❌ 封面圖生成失敗\n')
      continue
    }

    console.log('')
    console.log('✅ 封面圖生成成功!')
    console.log('   URL:', aiImage.url)
    console.log('   Credit:', aiImage.credit)

    // 檢查新圖片大小
    try {
      const response = await fetch(aiImage.url)
      const blob = await response.blob()
      console.log(`   大小: ${(blob.size / 1024).toFixed(1)} KB`)
    } catch (e) {
      // ignore
    }

    // 3. 更新資料庫
    console.log('\n💾 更新資料庫...')
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({
        cover_image: aiImage.url,
        image_credit: aiImage.credit
      })
      .eq('id', articleId)

    if (updateError) {
      console.error('❌ 更新失敗:', updateError)
      continue
    }

    console.log('✅ 資料庫更新成功!')
    console.log(`🔗 查看文章: https://wantcar.autos/2025/11/${articleId}`)
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('\n🎉 所有文章處理完成！\n')
}

// 執行
const articleIds = process.argv.slice(2)
if (articleIds.length === 0) {
  console.error('用法: npx tsx scripts/regenerate-with-reference.ts <article_id1> <article_id2> ...')
  console.error('範例: npx tsx scripts/regenerate-with-reference.ts mHNNoHo 2Ly1pyl')
  process.exit(1)
}

regenerateWithReference(articleIds).catch(console.error)
