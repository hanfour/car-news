#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

/**
 * 為指定文章重新生成 AI 封面圖
 */
async function regenerateCovers(articleIds: string[]) {
  const supabase = createServiceClient()

  console.log(`🎨 為 ${articleIds.length} 篇文章重新生成 AI 封面圖...\n`)

  for (const articleId of articleIds) {
    console.log('='.repeat(80))
    console.log(`\n處理文章: ${articleId}\n`)

    // 1. 獲取文章內容
    const { data: article, error: fetchError } = await supabase
      .from('generated_articles')
      .select('id, title_zh, content_zh, brands, cover_image')
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
    console.log('')

    // 檢查當前封面圖尺寸
    if (article.cover_image) {
      try {
        const response = await fetch(article.cover_image)
        const blob = await response.blob()
        console.log(`   當前封面圖大小: ${blob.size} bytes`)

        if (blob.size < 10000) {
          console.log(`   ⚠️  圖片過小 (<10KB)，確實需要重新生成`)
        }
      } catch (e) {
        console.log(`   ⚠️  無法訪問當前封面圖`)
      }
    }

    // 2. 生成 AI 封面圖
    console.log(`\n🤖 正在使用 DALL-E 3 生成封面圖...`)
    console.log('   (這可能需要 10-30 秒)\n')

    const aiImage = await generateAndSaveCoverImage(
      article.title_zh,
      article.content_zh,
      article.brands
    )

    if (!aiImage || !aiImage.url) {
      console.error('❌ AI 圖片生成失敗\n')
      continue
    }

    console.log('')
    console.log('✅ AI 封面圖生成成功!')
    console.log('   URL:', aiImage.url)
    console.log('   Credit:', aiImage.credit)

    // 檢查新圖片大小
    try {
      const response = await fetch(aiImage.url)
      const blob = await response.blob()
      console.log(`   新封面圖大小: ${blob.size} bytes`)
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
  console.error('用法: npx tsx scripts/regenerate-covers.ts <article_id1> <article_id2> ...')
  console.error('範例: npx tsx scripts/regenerate-covers.ts mHNNoHo 2Ly1pyl')
  process.exit(1)
}

regenerateCovers(articleIds).catch(console.error)
