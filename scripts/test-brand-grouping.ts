import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceClient } from '../src/lib/supabase'
import { groupArticlesByBrand, filterCarArticles } from '../src/lib/utils/brand-extractor'

async function test() {
  const supabase = createServiceClient()

  const { data: rawArticles, error } = await supabase
    .from('raw_articles')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (error || rawArticles === null) {
    console.error('Error fetching articles:', error)
    return
  }

  console.log('=== 品牌分組分析 ===')
  console.log('總文章數:', rawArticles.length)
  console.log('')

  // 過濾汽車文章
  const carArticles = filterCarArticles(rawArticles)
  console.log('過濾後的汽車文章數:', carArticles.length)
  console.log('')

  // 按品牌分組
  const brandGroups = groupArticlesByBrand(carArticles)

  console.log('=== 品牌分組結果 ===')
  for (const [brand, articles] of brandGroups.entries()) {
    console.log(`${brand}: ${articles.length} 篇`)
    // 顯示每個品牌的前2篇文章標題
    articles.slice(0, 2).forEach(a => {
      console.log(`  - ${a.title.substring(0, 70)}`)
    })
  }
}

test()
