/**
 * 移除現有文章中的重複來源標註區塊
 *
 * 移除格式如：
 * ---
 * 📣 **深入了解**
 * 本文資訊彙整自以下來源...
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 移除來源標註區塊的正則表達式
const SOURCE_BLOCK_PATTERNS = [
  // 📣 深入了解 區塊
  /\n*---\n*📣\s*\*?\*?深入了解\*?\*?[\s\S]*?(?=\n\n|$)/gi,
  // 或者沒有 --- 的版本
  /\n*📣\s*\*?\*?深入了解\*?\*?\n*本文資訊彙整自[\s\S]*?(?=\n\n|$)/gi,
  // 鼓勵讀者支持原創媒體
  /\n*\*本站專注於汽車數據分析，鼓勵讀者支持原創媒體。?\*\n*/gi,
]

function cleanContent(content: string): string {
  let cleaned = content
  for (const pattern of SOURCE_BLOCK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }
  // 清理多餘的空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return cleaned
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(dryRun ? '[DRY RUN] 檢查模式，不會實際更新' : '[LIVE] 將實際更新資料庫')

  // 查找包含來源標註的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh')
    .or('content_zh.ilike.%深入了解%,content_zh.ilike.%本文資訊彙整%')

  if (error) {
    console.error('查詢錯誤:', error)
    process.exit(1)
  }

  console.log(`找到 ${articles.length} 篇文章需要處理\n`)

  let updated = 0
  let skipped = 0

  for (const article of articles) {
    const originalContent = article.content_zh
    const cleanedContent = cleanContent(originalContent)

    if (originalContent === cleanedContent) {
      skipped++
      continue
    }

    console.log(`處理: ${article.title_zh?.slice(0, 40)}...`)
    console.log(`  移除 ${originalContent.length - cleanedContent.length} 字元`)

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({ content_zh: cleanedContent })
        .eq('id', article.id)

      if (updateError) {
        console.error(`  更新失敗:`, updateError.message)
      } else {
        updated++
      }
    } else {
      updated++
    }
  }

  console.log(`\n完成！`)
  console.log(`  更新: ${updated} 篇`)
  console.log(`  跳過: ${skipped} 篇`)
}

main().catch(console.error)
