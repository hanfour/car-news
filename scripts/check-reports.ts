import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function checkReports() {
  console.log('=== 檢查檢舉記錄 ===\n')

  // Article Reports
  const { data: articleReports, count: articleCount } = await supabase
    .from('article_reports')
    .select('*, generated_articles(title_zh)', { count: 'exact' })
    .order('created_at', { ascending: false })

  console.log(`📝 文章檢舉: ${articleCount} 筆`)
  if (articleReports && articleReports.length > 0) {
    articleReports.forEach((report, i) => {
      console.log(`\n${i + 1}. [${report.status}] ${report.reason}`)
      console.log(`   文章: ${(report.generated_articles as any)?.title_zh || 'N/A'}`)
      console.log(`   時間: ${report.created_at}`)
      if (report.description) {
        console.log(`   說明: ${report.description}`)
      }
    })
  } else {
    console.log('   (目前無檢舉記錄)')
  }

  // Comment Reports
  const { data: commentReports, count: commentCount } = await supabase
    .from('comment_reports')
    .select('*, comments(content)', { count: 'exact' })
    .order('created_at', { ascending: false })

  console.log(`\n💬 留言檢舉: ${commentCount} 筆`)
  if (commentReports && commentReports.length > 0) {
    commentReports.forEach((report, i) => {
      console.log(`\n${i + 1}. [${report.status}] ${report.reason}`)
      console.log(`   留言: ${(report.comments as any)?.content.slice(0, 50) || 'N/A'}...`)
      console.log(`   時間: ${report.created_at}`)
      if (report.description) {
        console.log(`   說明: ${report.description}`)
      }
    })
  } else {
    console.log('   (目前無檢舉記錄)')
  }

  console.log(`\n📊 總計: ${(articleCount || 0) + (commentCount || 0)} 筆檢舉`)
}

checkReports().catch(console.error)
