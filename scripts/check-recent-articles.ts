#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkRecentArticles() {
  console.log('🔍 檢查最近生成的文章...\n')
  console.log('='.repeat(80))

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, image_credit, published, created_at, confidence')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ 查詢失敗:', error.message)
    process.exit(1)
  }

  if (!articles || articles.length === 0) {
    console.log('❌ 沒有找到文章')
    process.exit(0)
  }

  console.log(`\n找到 ${articles.length} 篇最近的文章:\n`)

  for (const article of articles) {
    const hasImage = !!article.cover_image
    const imageStatus = hasImage ? '✅' : '❌'
    const publishedStatus = article.published ? '✅ 已發布' : '⏸️  草稿'

    console.log(`${imageStatus} ${publishedStatus} | ${article.created_at.slice(0, 19)}`)
    console.log(`   標題: ${article.title_zh}`)
    console.log(`   ID: ${article.id}`)

    if (hasImage) {
      const imageUrl = article.cover_image!.slice(0, 80)
      console.log(`   圖片: ${imageUrl}...`)
    } else {
      console.log(`   圖片: ❌ 無封面圖`)
    }

    console.log('')
  }

  console.log('='.repeat(80))

  const withImages = articles.filter(a => a.cover_image).length
  const published = articles.filter(a => a.published).length

  console.log(`\n📊 統計:`)
  console.log(`   有圖片: ${withImages}/${articles.length}`)
  console.log(`   已發布: ${published}/${articles.length}`)

  const publishedWithoutImages = articles.filter(a => a.published && !a.cover_image)

  if (publishedWithoutImages.length > 0) {
    console.log(`\n⚠️  警告: 有 ${publishedWithoutImages.length} 篇已發布的文章沒有封面圖！`)
    console.log(`\n可以執行: npx tsx scripts/fix-missing-covers.ts`)
  } else {
    console.log(`\n✅ 所有已發布的文章都有封面圖！`)
  }
}

checkRecentArticles().catch(error => {
  console.error('\n❌ 腳本執行失敗:', error)
  process.exit(1)
})
