/**
 * 運行文章生成器腳本
 *
 * 功能：
 * - 調用本地生成器 API（避免 Vercel 超時限制）
 * - 可重複執行直到所有文章處理完成
 * - 提供進度報告
 *
 * 用法：
 *   npx tsx scripts/run-generator.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://wantcar.autos'
const CRON_SECRET = process.env.CRON_SECRET?.trim()

if (!CRON_SECRET) {
  console.error('❌ Missing CRON_SECRET in .env.local')
  process.exit(1)
}

async function runGenerator() {
  console.log('\n🤖 ===== 運行文章生成器 =====\n')

  try {
    const response = await fetch(`${API_URL}/api/cron/generator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
      const text = await response.text()
      console.error(text)
      process.exit(1)
    }

    const result = await response.json()

    console.log('✅ 執行成功\n')
    console.log('結果：')
    console.log(JSON.stringify(result, null, 2))
    console.log('')

    // 如果還有更多文章要處理，提示用戶
    if (result.hasMore || result.processed < result.total) {
      console.log('💡 提示：還有更多文章需要處理，請再次運行此腳本')
      console.log('   npx tsx scripts/run-generator.ts\n')
    }

  } catch (error) {
    console.error('\n❌ 發生錯誤：', error)
    process.exit(1)
  }
}

// 執行
runGenerator()
