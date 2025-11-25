#!/usr/bin/env tsx

// MUST load env vars BEFORE importing any modules
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

/**
 * 為文章 jtZ4zTr 生成 AI 封面圖
 */
async function generateCover() {
  const supabase = createServiceClient()

  console.log('🎨 為文章 jtZ4zTr 生成 AI 封面圖...\n')

  // 1. 獲取文章內容
  const { data: article, error: fetchError } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, brands')
    .eq('id', 'jtZ4zTr')
    .single()

  if (fetchError || !article) {
    console.error('❌ 無法獲取文章:', fetchError)
    return
  }

  console.log('📄 文章信息:')
  console.log('   ID:', article.id)
  console.log('   標題:', article.title_zh)
  console.log('   品牌:', article.brands?.join(', ') || 'N/A')
  console.log('')

  // 2. 生成 AI 封面圖
  console.log('🤖 正在使用 DALL-E 3 生成封面圖...')
  console.log('   (這可能需要 10-30 秒)\n')

  const aiImage = await generateAndSaveCoverImage(
    article.title_zh,
    article.content_zh,
    article.brands
  )

  if (!aiImage || !aiImage.url) {
    console.error('❌ AI 圖片生成失敗')
    return
  }

  console.log('')
  console.log('✅ AI 封面圖生成成功!')
  console.log('   URL:', aiImage.url)
  console.log('   Credit:', aiImage.credit)
  console.log('')

  // 3. 更新資料庫
  console.log('💾 更新資料庫...')
  const { data: updated, error: updateError } = await supabase
    .from('generated_articles')
    .update({
      cover_image: aiImage.url,
      image_credit: aiImage.credit
    })
    .eq('id', 'jtZ4zTr')
    .select('id, title_zh, cover_image, image_credit')
    .single()

  if (updateError) {
    console.error('❌ 更新失敗:', updateError)
    return
  }

  console.log('✅ 資料庫更新成功!')
  console.log('')
  console.log('=' .repeat(80))
  console.log('🎉 完成！')
  console.log('')
  console.log('文章 ID:', updated.id)
  console.log('標題:', updated.title_zh)
  console.log('封面圖:', updated.cover_image)
  console.log('圖片來源:', updated.image_credit)
  console.log('')
  console.log(`🔗 查看文章: https://wantcar.autos/2025/11/${updated.id}`)
  console.log('=' .repeat(80))
}

generateCover().catch(console.error)
