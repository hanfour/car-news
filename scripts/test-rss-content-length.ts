import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Parser from 'rss-parser'
import sources from '../src/config/sources.json'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)'
  }
})

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function testRSSContentLength() {
  const enabledSources = sources.filter((s: any) => s.enabled)

  console.log(`Testing ${enabledSources.length} RSS sources for content length...\n`)

  let totalArticles = 0
  let filtered200 = 0  // 被 200 字過濾掉的
  let filtered100 = 0  // 只有 100 字以下的
  let passed200 = 0    // 超過 200 字的

  for (const source of enabledSources.slice(0, 10)) {  // 只測前 10 個
    try {
      console.log(`\n=== ${source.name} ===`)
      const feed = await parser.parseURL(source.url)

      const contentLengths: number[] = []

      for (const item of feed.items.slice(0, 5)) {  // 每個來源取前 5 篇
        if (!item.link || !item.title) continue

        let content = ''
        if (item.content) {
          content = stripHtml(item.content)
        } else if (item.contentSnippet) {
          content = item.contentSnippet
        } else if (item.summary) {
          content = stripHtml(item.summary)
        }

        contentLengths.push(content.length)
        totalArticles++

        if (content.length < 100) {
          filtered100++
          console.log(`  ❌ ${content.length} chars - "${item.title?.slice(0, 50)}..."`)
        } else if (content.length < 200) {
          filtered200++
          console.log(`  ⚠️  ${content.length} chars - "${item.title?.slice(0, 50)}..."`)
        } else {
          passed200++
          console.log(`  ✅ ${content.length} chars - "${item.title?.slice(0, 50)}..."`)
        }
      }

      const avg = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length
      console.log(`  平均長度: ${Math.round(avg)} 字`)

    } catch (error) {
      console.error(`  Error: ${(error as Error).message}`)
    }
  }

  console.log('\n\n=== 總結 ===')
  console.log(`總文章數: ${totalArticles}`)
  console.log(`✅ 超過 200 字 (會保存): ${passed200} (${Math.round(passed200/totalArticles*100)}%)`)
  console.log(`⚠️  100-200 字 (被過濾): ${filtered200} (${Math.round(filtered200/totalArticles*100)}%)`)
  console.log(`❌ 少於 100 字 (被過濾): ${filtered100} (${Math.round(filtered100/totalArticles*100)}%)`)
  console.log(`\n建議: 如果被過濾比例太高，考慮降低 200 字門檻或改為抓取全文`)
}

testRSSContentLength()
