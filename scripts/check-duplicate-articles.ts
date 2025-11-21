import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkDuplicates() {
  const ids = ['YcyFVum', 'eHuulRW', 'YAmIDBq', 'xcDFuJz']

  console.log('\n=== 檢查重複文章 ===\n')

  for (const id of ids) {
    const { data: article } = await supabase
      .from('generated_articles')
      .select('id, title_zh, title_en, published_at, source_urls, content_zh')
      .eq('id', id)
      .single()

    if (article) {
      console.log(`\n📄 ID: ${id}`)
      console.log(`   中文標題: ${article.title_zh}`)
      console.log(`   英文標題: ${article.title_en}`)
      console.log(`   發布日期: ${article.published_at}`)
      console.log(`   來源數量: ${article.source_urls?.length || 0}`)
      if (article.source_urls && article.source_urls.length > 0) {
        console.log(`   第一個來源: ${article.source_urls[0]}`)
      }
      console.log(`   內容長度: ${article.content_zh?.length || 0} 字`)
    } else {
      console.log(`\n❌ ID: ${id} - 未找到`)
    }
  }

  // 比較相似度
  console.log('\n\n=== 相似度分析 ===\n')

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, title_en, content_zh')
    .in('id', ids)

  if (articles && articles.length >= 2) {
    // 比較第一組
    const pair1 = articles.filter(a => ['YcyFVum', 'eHuulRW'].includes(a.id))
    if (pair1.length === 2) {
      console.log('組 1: YcyFVum vs eHuulRW')
      console.log(`  標題 1: ${pair1[0].title_zh}`)
      console.log(`  標題 2: ${pair1[1].title_zh}`)

      // 簡單的標題相似度檢查
      const words1 = new Set(pair1[0].title_zh.split(/\s+/))
      const words2 = new Set(pair1[1].title_zh.split(/\s+/))
      const intersection = new Set([...words1].filter(x => words2.has(x)))
      const similarity = (intersection.size * 2) / (words1.size + words2.size)
      console.log(`  標題相似度: ${(similarity * 100).toFixed(1)}%`)
    }

    // 比較第二組
    const pair2 = articles.filter(a => ['YAmIDBq', 'xcDFuJz'].includes(a.id))
    if (pair2.length === 2) {
      console.log('\n組 2: YAmIDBq vs xcDFuJz')
      console.log(`  標題 1: ${pair2[0].title_zh}`)
      console.log(`  標題 2: ${pair2[1].title_zh}`)

      const words1 = new Set(pair2[0].title_zh.split(/\s+/))
      const words2 = new Set(pair2[1].title_zh.split(/\s+/))
      const intersection = new Set([...words1].filter(x => words2.has(x)))
      const similarity = (intersection.size * 2) / (words1.size + words2.size)
      console.log(`  標題相似度: ${(similarity * 100).toFixed(1)}%`)
    }
  }

  console.log('\n')
}

checkDuplicates()
