#!/usr/bin/env tsx

/**
 * 检查所有已发布文章的封面图状态
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function checkCoverImages() {
  const supabase = createServiceClient()

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, image_credit')
    .eq('published', true)

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  // 统计各种图片来源
  let noImage = 0
  let aiGenerated = 0
  let supabaseStorage = 0
  let original = 0
  let other = 0

  const noImageArticles: Array<{ id: string; title: string }> = []

  for (const article of articles) {
    if (!article.cover_image) {
      noImage++
      noImageArticles.push({
        id: article.id,
        title: article.title_zh.slice(0, 50)
      })
    } else if (article.cover_image.includes('supabase.co/storage')) {
      if (article.image_credit?.includes('AI')) {
        aiGenerated++
      } else {
        supabaseStorage++
      }
    } else if (article.image_credit === 'original' || article.image_credit === '來源網站') {
      original++
    } else {
      other++
    }
  }

  console.log('='.repeat(60))
  console.log('📊 封面图统计')
  console.log('='.repeat(60))
  console.log('')
  console.log(`总文章数: ${articles.length}`)
  console.log('')
  console.log(`✅ 有封面图: ${articles.length - noImage}`)
  console.log(`   - AI 生成: ${aiGenerated}`)
  console.log(`   - Supabase 存储: ${supabaseStorage}`)
  console.log(`   - 原文图片: ${original}`)
  console.log(`   - 其他来源: ${other}`)
  console.log('')
  console.log(`❌ 无封面图: ${noImage}`)

  if (noImageArticles.length > 0) {
    console.log('')
    console.log('缺少封面的文章:')
    for (const a of noImageArticles.slice(0, 20)) {
      console.log(`   - ${a.id}: ${a.title}...`)
    }
    if (noImageArticles.length > 20) {
      console.log(`   ... 还有 ${noImageArticles.length - 20} 篇`)
    }
  }
  console.log('')
  console.log('='.repeat(60))
}

checkCoverImages().catch(console.error)
