#!/usr/bin/env tsx

/**
 * 为缺少封面的文章生成 AI 封面图
 *
 * 使用场景：
 * 1. 清理非法图片后，为这些文章生成新封面
 * 2. 为新发布但没有官方图片的文章生成封面
 *
 * 使用方式：
 * npx tsx scripts/regenerate-missing-covers.ts          # 预览模式
 * npx tsx scripts/regenerate-missing-covers.ts --run    # 执行生成
 * npx tsx scripts/regenerate-missing-covers.ts --limit 5 # 只处理5篇
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { generateAndSaveCoverImage } from '../src/lib/ai/image-generation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ArticleWithoutCover {
  id: string
  title_zh: string
  content_zh: string
  brands: string[] | null
  published_at: string | null
}

async function getArticlesWithoutCover(): Promise<ArticleWithoutCover[]> {
  const { data, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh, brands, published_at')
    .is('cover_image', null)
    .eq('published', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('❌ 获取文章失败:', error.message)
    return []
  }

  return data || []
}

async function generateCoverForArticle(article: ArticleWithoutCover): Promise<boolean> {
  console.log(`\n📷 生成封面: ${article.title_zh.slice(0, 50)}...`)

  try {
    const result = await generateAndSaveCoverImage(
      article.title_zh,
      article.content_zh,
      article.brands || undefined
    )

    if (!result || !result.url) {
      console.error('   ❌ 生成失败: 无返回结果')
      return false
    }

    // 更新数据库
    const { error } = await supabase
      .from('generated_articles')
      .update({
        cover_image: result.url,
        image_credit: result.credit
      })
      .eq('id', article.id)

    if (error) {
      console.error('   ❌ 更新数据库失败:', error.message)
      return false
    }

    console.log('   ✅ 成功生成并保存')
    console.log(`   📍 URL: ${result.url.slice(0, 60)}...`)
    return true

  } catch (error: any) {
    console.error('   ❌ 生成异常:', error.message)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const shouldRun = args.includes('--run')
  const limitArg = args.find(a => a.startsWith('--limit'))
  const limit = limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1]) : undefined

  console.log('🚀 AI 封面图生成工具\n')
  console.log('='.repeat(60))

  // 检查 API Key
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.error('❌ 缺少 OPENAI_API_KEY 环境变量')
    process.exit(1)
  }
  console.log(`✓ OpenAI API Key: ${openaiKey.slice(0, 10)}...${openaiKey.slice(-4)}`)

  // 获取缺少封面的文章
  console.log('\n🔍 查找缺少封面的文章...')
  const articles = await getArticlesWithoutCover()

  if (articles.length === 0) {
    console.log('\n✅ 所有文章都有封面图，无需处理')
    return
  }

  console.log(`\n📊 找到 ${articles.length} 篇缺少封面的文章`)

  // 应用限制
  const toProcess = limit ? articles.slice(0, limit) : articles
  console.log(`📝 将处理 ${toProcess.length} 篇文章`)

  if (!shouldRun) {
    console.log('\n' + '='.repeat(60))
    console.log('📖 预览模式 - 不会执行生成')
    console.log('使用 --run 参数执行实际生成')
    console.log('\n待处理文章列表:')
    for (const article of toProcess.slice(0, 10)) {
      console.log(`   - ${article.title_zh.slice(0, 50)}... (${article.id})`)
    }
    if (toProcess.length > 10) {
      console.log(`   ... 还有 ${toProcess.length - 10} 篇`)
    }

    // 成本估算
    const estimatedCost = toProcess.length * 0.04 // DALL-E 3 standard 约 $0.04/张
    console.log(`\n💰 预估成本: $${estimatedCost.toFixed(2)} (DALL-E 3 standard)`)
    return
  }

  // 执行生成
  console.log('\n' + '='.repeat(60))
  console.log('🎨 开始生成 AI 封面图...\n')

  let success = 0
  let failed = 0

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i]
    console.log(`\n[${i + 1}/${toProcess.length}]`)

    const result = await generateCoverForArticle(article)
    if (result) {
      success++
    } else {
      failed++
    }

    // 避免 API 限流，每次生成后等待 2 秒
    if (i < toProcess.length - 1) {
      console.log('   ⏳ 等待 2 秒...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 生成结果:')
  console.log(`   ✅ 成功: ${success} 张`)
  console.log(`   ❌ 失败: ${failed} 张`)

  const actualCost = success * 0.04
  console.log(`   💰 实际成本: ~$${actualCost.toFixed(2)}`)

  console.log('\n✅ 完成！')
}

main().catch(error => {
  console.error('\n❌ 执行失败:', error)
  process.exit(1)
})
