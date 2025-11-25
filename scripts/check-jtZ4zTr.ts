#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceClient } from '../src/lib/supabase'

async function check() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, images, created_at')
    .eq('id', 'jtZ4zTr')
    .single()

  if (!data) {
    console.log('Article not found')
    return
  }

  console.log('文章 jtZ4zTr 分析:')
  console.log('標題:', data.title_zh)
  console.log('封面圖:', data.cover_image)
  console.log('圖片陣列長度:', data.images?.length || 0)
  console.log('創建時間:', new Date(data.created_at).toLocaleString('zh-TW'))
  console.log('\n問題: 封面圖使用外部 URL (Toyota AWS)，返回 403 Forbidden')
  console.log('原因: 該文章創建時可能還沒有部署圖片下載功能，或下載失敗')
  console.log('\n解決方案:')
  console.log('1. 手動更新該文章的 cover_image 為 null (使用預設佔位符)')
  console.log('2. 或找到可用的替代圖片 URL')
  console.log('3. 或重新生成該文章')
}

check().catch(console.error)
