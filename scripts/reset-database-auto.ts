/**
 * 自動執行資料庫完全重置（無需交互式確認）
 * 僅供腳本自動化使用
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetDatabase() {
  console.log('\n🗑️  開始清理資料庫...\n')

  const startTime = Date.now()

  try {
    // 按照外鍵依賴順序刪除（從子表到父表）

    // 1. 刪除檢舉
    console.log('1️⃣  刪除檢舉數據...')
    await supabase.from('article_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('comment_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 檢舉數據已刪除')

    // 2. 刪除廣告
    console.log('2️⃣  刪除廣告數據...')
    await supabase.from('ads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 廣告數據已刪除')

    // 3. 刪除留言回覆
    console.log('3️⃣  刪除留言回覆...')
    await supabase.from('comment_replies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 留言回覆已刪除')

    // 4. 刪除留言按讚
    console.log('4️⃣  刪除留言按讚...')
    await supabase.from('comment_likes').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 留言按讚已刪除')

    // 5. 刪除留言
    console.log('5️⃣  刪除留言...')
    await supabase.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 留言已刪除')

    // 6. 刪除文章按讚
    console.log('6️⃣  刪除文章按讚...')
    await supabase.from('article_likes').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 文章按讚已刪除')

    // 7. 刪除文章分享
    console.log('7️⃣  刪除文章分享...')
    await supabase.from('article_shares').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 文章分享已刪除')

    // 8. 刪除收藏
    console.log('8️⃣  刪除收藏...')
    await supabase.from('user_favorites').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 收藏已刪除')

    // 9. 刪除主題鎖
    console.log('9️⃣  刪除主題鎖...')
    await supabase.from('daily_topic_locks').delete().neq('date', '1900-01-01')
    console.log('  ✓ 主題鎖已刪除')

    // 10. 刪除生成文章
    console.log('🔟 刪除生成文章...')
    await supabase.from('generated_articles').delete().neq('id', 'XXXXXXX')
    console.log('  ✓ 生成文章已刪除')

    // 11. 刪除文章聚類
    console.log('1️⃣1️⃣  刪除文章聚類...')
    await supabase.from('article_clusters').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 文章聚類已刪除')

    // 12. 刪除原始文章
    console.log('1️⃣2️⃣  刪除原始文章...')
    await supabase.from('raw_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 原始文章已刪除')

    // 13. 刪除用戶資料（profiles）
    console.log('1️⃣3️⃣  刪除用戶資料...')
    await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✓ 用戶資料已刪除')

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n✅ 資料庫重置完成！（耗時 ${duration} 秒）\n`)

  } catch (error) {
    console.error('\n❌ 發生錯誤：', error)
    process.exit(1)
  }
}

// 執行重置
resetDatabase()
