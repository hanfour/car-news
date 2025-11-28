#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

/**
 * 為沒有封面圖的文章生成 AI 圖片
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixMissingCovers() {
  console.log('🔍 查找沒有封面圖的文章...\n')

  // 查找沒有封面圖的已發布文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, cover_image, brands, categories, confidence, created_at')
    .is('cover_image', null)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ 查詢失敗:', error.message)
    process.exit(1)
  }

  if (!articles || articles.length === 0) {
    console.log('✅ 沒有缺少封面圖的文章！')
    process.exit(0)
  }

  console.log(`找到 ${articles.length} 篇沒有封面圖的文章\n`)
  console.log('='.repeat(80))

  let successCount = 0
  let failCount = 0

  for (const article of articles) {
    console.log(`\n📄 處理文章: ${article.title_zh}`)
    console.log(`   ID: ${article.id}`)
    console.log(`   信心度: ${article.confidence}%`)
    console.log(`   分類: ${article.categories?.join(', ') || 'N/A'}`)
    console.log(`   品牌: ${article.brands?.join(', ') || 'N/A'}`)

    try {
      // 生成 AI 封面圖
      console.log(`   → 生成 AI 封面圖 (DALL-E 3, $0.08)...`)
      const aiImage = await generateAndSaveCoverImage(
        article.title_zh,
        article.content_zh,
        article.brands || []
      )

      if (aiImage && aiImage.url) {
        // 更新文章
        const { error: updateError } = await supabase
          .from('generated_articles')
          .update({
            cover_image: aiImage.url,
            image_credit: aiImage.credit
          })
          .eq('id', article.id)

        if (updateError) {
          console.log(`   ❌ 更新失敗: ${updateError.message}`)
          failCount++
        } else {
          console.log(`   ✅ 封面圖已生成並更新`)
          successCount++
        }
      } else {
        console.log(`   ❌ 圖片生成失敗`)
        failCount++
      }

    } catch (error: any) {
      console.error(`   ❌ 錯誤: ${error.message}`)
      failCount++
    }

    // 避免 API rate limit
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n✅ 完成！`)
  console.log(`   成功: ${successCount} 篇`)
  console.log(`   失敗: ${failCount} 篇`)
  console.log(`   成本: $${(successCount * 0.08).toFixed(2)}`)
}

fixMissingCovers().catch(error => {
  console.error('\n❌ 腳本執行失敗:', error)
  process.exit(1)
})
