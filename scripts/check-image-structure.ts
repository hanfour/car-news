#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'

async function checkImageStructure() {
  const supabase = createServiceClient()

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, images')
    .in('id', ['mHNNoHo', 'jtZ4zTr', '2Ly1pyl'])

  if (error) {
    console.error('❌ 查詢失敗:', error)
    return
  }

  console.log('🔍 檢查圖片欄位結構...\n')

  articles?.forEach(article => {
    console.log(`\n【${article.id}】${article.title_zh}`)
    console.log(`images 類型: ${typeof article.images}`)
    console.log(`images 是陣列: ${Array.isArray(article.images)}`)
    console.log(`images 長度: ${article.images?.length || 0}`)
    console.log(`images 內容:`)
    console.log(JSON.stringify(article.images, null, 2))

    if (article.images && article.images.length > 0) {
      console.log(`\n第一個元素類型: ${typeof article.images[0]}`)
      if (typeof article.images[0] === 'object') {
        console.log(`第一個元素內容:`, JSON.stringify(article.images[0], null, 2))
        console.log(`⚠️  圖片欄位格式錯誤！應該是字串陣列，不是物件陣列`)
      }
    }
    console.log('-'.repeat(80))
  })
}

checkImageStructure().catch(console.error)
