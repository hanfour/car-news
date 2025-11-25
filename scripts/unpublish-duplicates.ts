#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'

async function unpublishArticles(articleIds: string[]) {
  const supabase = createServiceClient()

  console.log(`📝 將 ${articleIds.length} 篇文章設為 unpublished...\n`)

  for (const id of articleIds) {
    const { data, error } = await supabase
      .from('generated_articles')
      .update({ published: false, published_at: null })
      .eq('id', id)
      .select('id, title_zh, published')
      .single()

    if (error) {
      console.log(`❌ ${id} - 失敗:`, error.message)
    } else {
      console.log(`✓ ${id} - ${data.title_zh}`)
    }
  }

  console.log(`\n✅ 完成！${articleIds.length} 篇文章已下線`)
  console.log(`\n📊 這些文章現在:`)
  console.log(`   • 不會出現在網站上`)
  console.log(`   • 仍保留在資料庫中（可恢復）`)
  console.log(`   • published = false`)
}

const ids = process.argv.slice(2)
if (ids.length === 0) {
  console.log('用法: npx tsx scripts/unpublish-duplicates.ts <id1> <id2> ...')
  process.exit(1)
}

unpublishArticles(ids).catch(console.error)
