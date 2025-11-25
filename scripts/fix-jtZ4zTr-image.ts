#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceClient } from '../src/lib/supabase'

/**
 * Fix article jtZ4zTr's broken cover image
 * Option 1: Set cover_image to null (will show gradient placeholder)
 * Option 2: Try to download and store the image again
 */

async function fixImage() {
  const supabase = createServiceClient()

  console.log('🔧 修復文章 jtZ4zTr 的封面圖...\n')

  // Option 1: Set to null (使用預設佔位符)
  console.log('方案: 將封面圖設為 null，使用漸層佔位符\n')

  const { data, error } = await supabase
    .from('generated_articles')
    .update({
      cover_image: null,
      image_credit: null
    })
    .eq('id', 'jtZ4zTr')
    .select('id, title_zh, cover_image')
    .single()

  if (error) {
    console.error('❌ 更新失敗:', error)
    return
  }

  console.log('✅ 更新成功!')
  console.log('   文章ID:', data.id)
  console.log('   標題:', data.title_zh)
  console.log('   封面圖:', data.cover_image || '(null - 將使用預設佔位符)')
  console.log('\n現在用戶將看到漸層色背景 + 品牌圖示作為封面')
}

fixImage().catch(console.error)
