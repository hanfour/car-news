/**
 * 完全重置資料庫
 *
 * ⚠️ 警告：此腳本會刪除所有數據，包括：
 * - 文章（generated_articles, raw_articles）
 * - 用戶互動（comments, likes, favorites, shares）
 * - 檢舉和廣告（reports, ads）
 * - 用戶資料（profiles）
 * - 聚類和主題鎖（clusters, topic_locks）
 *
 * 執行前請確保：
 * 1. 已經備份重要數據
 * 2. 確定要完全重置
 * 3. 在開發環境測試過
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as readline from 'readline'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 創建 readline interface 用於確認
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function resetDatabase() {
  console.log('\n🚨 ===== 資料庫完全重置 =====\n')
  console.log('此操作將刪除以下所有數據：')
  console.log('  • 文章數據（generated_articles, raw_articles, article_clusters）')
  console.log('  • 用戶互動（comments, comment_replies, article_likes, comment_likes）')
  console.log('  • 用戶收藏和分享（user_favorites, article_shares）')
  console.log('  • 檢舉和廣告（article_reports, comment_reports, ads）')
  console.log('  • 用戶資料（profiles）')
  console.log('  • 主題鎖（daily_topic_locks）')
  console.log('\n⚠️  此操作無法撤銷！\n')

  // 第一次確認
  const confirm1 = await askQuestion('確定要繼續嗎？請輸入 "RESET" 以確認：')
  if (confirm1.trim() !== 'RESET') {
    console.log('❌ 取消操作')
    rl.close()
    return
  }

  // 第二次確認
  const confirm2 = await askQuestion('再次確認：這將刪除所有數據，請輸入 "I UNDERSTAND"：')
  if (confirm2.trim() !== 'I UNDERSTAND') {
    console.log('❌ 取消操作')
    rl.close()
    return
  }

  rl.close()

  console.log('\n🗑️  開始清理資料庫...\n')

  try {
    // 按照外鍵依賴順序刪除（從子表到父表）

    // 1. 刪除檢舉
    console.log('1️⃣  刪除檢舉數據...')
    const { error: reportsError } = await supabase.from('article_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (reportsError && reportsError.code !== 'PGRST116') console.error('  ⚠️  article_reports:', reportsError.message)

    const { error: commentReportsError } = await supabase.from('comment_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (commentReportsError && commentReportsError.code !== 'PGRST116') console.error('  ⚠️  comment_reports:', commentReportsError.message)
    console.log('  ✓ 檢舉數據已刪除')

    // 2. 刪除廣告
    console.log('2️⃣  刪除廣告數據...')
    const { error: adsError } = await supabase.from('ads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (adsError && adsError.code !== 'PGRST116') console.error('  ⚠️  ads:', adsError.message)
    console.log('  ✓ 廣告數據已刪除')

    // 3. 刪除留言回覆
    console.log('3️⃣  刪除留言回覆...')
    const { error: repliesError } = await supabase.from('comment_replies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (repliesError && repliesError.code !== 'PGRST116') console.error('  ⚠️  comment_replies:', repliesError.message)
    console.log('  ✓ 留言回覆已刪除')

    // 4. 刪除留言按讚
    console.log('4️⃣  刪除留言按讚...')
    const { error: commentLikesError } = await supabase.from('comment_likes').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    if (commentLikesError && commentLikesError.code !== 'PGRST116') console.error('  ⚠️  comment_likes:', commentLikesError.message)
    console.log('  ✓ 留言按讚已刪除')

    // 5. 刪除留言
    console.log('5️⃣  刪除留言...')
    const { error: commentsError } = await supabase.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (commentsError && commentsError.code !== 'PGRST116') console.error('  ⚠️  comments:', commentsError.message)
    console.log('  ✓ 留言已刪除')

    // 6. 刪除文章按讚
    console.log('6️⃣  刪除文章按讚...')
    const { error: articleLikesError } = await supabase.from('article_likes').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    if (articleLikesError && articleLikesError.code !== 'PGRST116') console.error('  ⚠️  article_likes:', articleLikesError.message)
    console.log('  ✓ 文章按讚已刪除')

    // 7. 刪除文章分享
    console.log('7️⃣  刪除文章分享...')
    const { error: sharesError } = await supabase.from('article_shares').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (sharesError && sharesError.code !== 'PGRST116') console.error('  ⚠️  article_shares:', sharesError.message)
    console.log('  ✓ 文章分享已刪除')

    // 8. 刪除收藏
    console.log('8️⃣  刪除收藏...')
    const { error: favoritesError } = await supabase.from('user_favorites').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    if (favoritesError && favoritesError.code !== 'PGRST116') console.error('  ⚠️  user_favorites:', favoritesError.message)
    console.log('  ✓ 收藏已刪除')

    // 9. 刪除主題鎖
    console.log('9️⃣  刪除主題鎖...')
    const { error: locksError } = await supabase.from('daily_topic_locks').delete().neq('date', '1900-01-01')
    if (locksError && locksError.code !== 'PGRST116') console.error('  ⚠️  daily_topic_locks:', locksError.message)
    console.log('  ✓ 主題鎖已刪除')

    // 10. 刪除生成文章
    console.log('🔟 刪除生成文章...')
    const { error: generatedError } = await supabase.from('generated_articles').delete().neq('id', 'XXXXXXX')
    if (generatedError && generatedError.code !== 'PGRST116') console.error('  ⚠️  generated_articles:', generatedError.message)
    console.log('  ✓ 生成文章已刪除')

    // 11. 刪除文章聚類
    console.log('1️⃣1️⃣  刪除文章聚類...')
    const { error: clustersError } = await supabase.from('article_clusters').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (clustersError && clustersError.code !== 'PGRST116') console.error('  ⚠️  article_clusters:', clustersError.message)
    console.log('  ✓ 文章聚類已刪除')

    // 12. 刪除原始文章
    console.log('1️⃣2️⃣  刪除原始文章...')
    const { error: rawError } = await supabase.from('raw_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (rawError && rawError.code !== 'PGRST116') console.error('  ⚠️  raw_articles:', rawError.message)
    console.log('  ✓ 原始文章已刪除')

    // 13. 刪除用戶資料（profiles）
    console.log('1️⃣3️⃣  刪除用戶資料...')
    const { error: profilesError } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (profilesError && profilesError.code !== 'PGRST116') console.error('  ⚠️  profiles:', profilesError.message)
    console.log('  ✓ 用戶資料已刪除')

    console.log('\n✅ 資料庫重置完成！')
    console.log('\n下一步：')
    console.log('  1. 運行爬蟲腳本回溯爬取過去 6 個月的文章')
    console.log('  2. 運行生成器生成中文文章')
    console.log('  3. 檢查生成的文章是否正確使用了原始發布時間\n')

  } catch (error) {
    console.error('\n❌ 發生錯誤：', error)
    process.exit(1)
  }
}

// 執行重置
resetDatabase()
