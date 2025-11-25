#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function checkCoverImages() {
  const supabase = createServiceClient()

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, images')
    .in('id', ['mHNNoHo', '2Ly1pyl'])

  console.log('🔍 檢查封面圖片來源...\n')

  for (const article of articles || []) {
    console.log(`【文章 ${article.id}】`)
    console.log(`標題: ${article.title_zh}`)
    console.log(`封面圖: ${article.cover_image}`)
    console.log(`圖片陣列長度: ${article.images?.length || 0}`)

    if (article.images?.length > 0) {
      console.log(`\n第一張圖片 (用作封面):`)
      console.log(JSON.stringify(article.images[0], null, 2))
    }

    // 測試封面圖 URL 是否可訪問
    if (article.cover_image) {
      console.log(`\n測試封面圖 URL...`)
      try {
        const response = await fetch(article.cover_image, { method: 'HEAD' })
        console.log(`HTTP Status: ${response.status} ${response.statusText}`)
        console.log(`Content-Type: ${response.headers.get('content-type')}`)

        if (response.status === 403) {
          console.log(`⚠️  防盜連！需要重新生成或替換封面圖`)
        } else if (response.status === 200) {
          console.log(`✅ 圖片可正常訪問`)
        }
      } catch (error: any) {
        console.log(`❌ 測試失敗: ${error.message}`)
      }
    }
    console.log('-'.repeat(80) + '\n')
  }
}

checkCoverImages().catch(console.error)
