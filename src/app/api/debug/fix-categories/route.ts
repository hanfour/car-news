import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { verifyDebugAccess } from '@/lib/admin/auth'
import Anthropic from '@anthropic-ai/sdk'

const CATEGORY_RULES = `
請根據以下標準重新判斷文章分類（選擇1-2個最符合的）：

可用分類選項：新車、評測、電動車、產業、科技、賽車

分類標準：
- 新車：新車型發表、上市資訊、車款改款（必須有具體新車型或改款資訊）
- 評測：試駕報告、性能測試、車輛比較（必須有實際測試內容）
- 電動車：電動車相關新聞、電池技術、充電設施（主要討論電動車議題）
- 產業：車企財報、市場分析、產業趨勢、併購重組、股價薪酬、銷售策略（企業層面的商業新聞）
- 科技：自動駕駛、車聯網、AI應用、創新技術（前沿技術為主）
- 賽車：賽事報導、車隊動態、賽車運動（必須與競速賽事相關）

⚠️ 重點判斷標準：
- 如果文章主要討論股價、薪酬、財報、市場份額、企業策略、銷售數據 → 選「產業」
- 如果文章主要討論新車型號、規格、上市時間 → 選「新車」
- 如果文章主要討論電池、充電、電動車技術 → 選「電動車」
- 短租服務、銷售策略等商業決策 → 屬於「產業」而非「新車」

⚠️ 注意：資料庫中可能使用「行業」或「產業」，請統一輸出為「產業」

回答格式（純JSON，不要markdown）：
{
  "categories": ["產業"],
  "reasoning": "簡短說明為什麼選擇這個分類"
}
`

export async function GET(request: NextRequest) {
  const access = await verifyDebugAccess(request)
  if (!access.allowed) return access.response!

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'check' // check | fix

  const supabase = createClient()

  // 獲取所有已發布的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, categories')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!articles) {
    return NextResponse.json({ articles: [] })
  }

  // 找出可能分類錯誤的文章
  const suspiciousArticles = articles.filter(article => {
    const title = article.title_zh.toLowerCase()
    const categories = article.categories || []

    // 檢查：包含財務/股價/薪酬關鍵詞但分類為「新車」
    const hasBusinessKeywords =
      title.includes('股') ||
      title.includes('薪酬') ||
      title.includes('財報') ||
      title.includes('市值') ||
      title.includes('股東') ||
      title.includes('股價') ||
      title.includes('市佔') ||
      title.includes('利潤') ||
      title.includes('營收')

    const hasNewCarCategory = categories.includes('新車')

    return hasBusinessKeywords && hasNewCarCategory
  })

  if (action === 'check') {
    return NextResponse.json({
      total: articles.length,
      suspicious: suspiciousArticles.length,
      articles: suspiciousArticles.map(a => ({
        id: a.id,
        title: a.title_zh,
        currentCategories: a.categories
      }))
    })
  }

  // action === 'fix'
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  })

  const fixed = []
  const failed = []

  for (const article of suspiciousArticles) {
    try {
      const prompt = `
${CATEGORY_RULES}

文章標題：${article.title_zh}
文章內容：${article.content_zh.slice(0, 1000)}...

當前分類：${JSON.stringify(article.categories)}

請重新判斷正確的分類：
`

      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const result = JSON.parse(jsonText)

      // 更新文章分類
      const { error: updateError } = await supabase
        .from('generated_articles')
        .update({ categories: result.categories })
        .eq('id', article.id)

      if (updateError) {
        failed.push({
          id: article.id,
          title: article.title_zh,
          error: updateError.message
        })
      } else {
        fixed.push({
          id: article.id,
          title: article.title_zh,
          oldCategories: article.categories,
          newCategories: result.categories,
          reasoning: result.reasoning
        })
      }

      // 避免 API rate limit
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error: any) {
      failed.push({
        id: article.id,
        title: article.title_zh,
        error: error.message
      })
    }
  }

  return NextResponse.json({
    fixed: fixed.length,
    failed: failed.length,
    details: { fixed, failed }
  })
}
