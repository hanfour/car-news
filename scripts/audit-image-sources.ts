/**
 * 图片来源审计脚本
 *
 * 功能：
 * 1. 扫描所有文章的封面图片
 * 2. 检查每个图片 URL 是否来自合法来源
 * 3. 生成审计报告
 * 4. 可选：清理非法来源的图片
 *
 * 使用方式：
 * npx tsx scripts/audit-image-sources.ts          # 仅审计
 * npx tsx scripts/audit-image-sources.ts --clean  # 审计并清理
 */

import { createClient } from '@supabase/supabase-js'
import { isLegalImageSource, getImageSourceCredit } from '../src/config/image-sources'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface AuditResult {
  articleId: string
  title: string
  imageUrl: string
  isLegal: boolean
  source: string
  domain: string
}

async function auditImageSources(): Promise<AuditResult[]> {
  console.log('🔍 开始审计图片来源...\n')

  // 获取所有有封面图的文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image')
    .not('cover_image', 'is', null)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('❌ 获取文章失败:', error.message)
    process.exit(1)
  }

  console.log(`📊 共找到 ${articles.length} 篇有封面图的文章\n`)

  const results: AuditResult[] = []
  const stats = {
    total: articles.length,
    legal: 0,
    illegal: 0,
    supabaseStorage: 0,
    aiGenerated: 0,
  }

  for (const article of articles) {
    const imageUrl = article.cover_image as string

    // 检查是否是 Supabase Storage 的图片（已经存储的）
    if (imageUrl.includes('supabase.co/storage')) {
      stats.supabaseStorage++
      // 对于已存储的图片，我们无法判断原始来源
      // 这些需要人工审核或根据 image_credit 字段判断
      results.push({
        articleId: article.id,
        title: article.title_zh,
        imageUrl,
        isLegal: true, // 假设已存储的是合法的
        source: 'supabase_storage',
        domain: 'supabase.co',
      })
      continue
    }

    // 检查是否是 AI 生成的图片
    if (imageUrl.includes('oaidalleapiprodscus') || imageUrl.includes('openai')) {
      stats.aiGenerated++
      results.push({
        articleId: article.id,
        title: article.title_zh,
        imageUrl,
        isLegal: true,
        source: 'ai_generated',
        domain: 'openai.com',
      })
      continue
    }

    // 检查外部图片来源
    const check = isLegalImageSource(imageUrl)

    if (check.isLegal) {
      stats.legal++
    } else {
      stats.illegal++
    }

    results.push({
      articleId: article.id,
      title: article.title_zh,
      imageUrl,
      isLegal: check.isLegal,
      source: check.source,
      domain: check.domain,
    })
  }

  return results
}

function printReport(results: AuditResult[]) {
  const legal = results.filter(r => r.isLegal)
  const illegal = results.filter(r => !r.isLegal)

  console.log('\n' + '='.repeat(60))
  console.log('📋 图片来源审计报告')
  console.log('='.repeat(60))

  console.log(`\n📊 统计摘要：`)
  console.log(`   总计：${results.length} 张图片`)
  console.log(`   ✅ 合法来源：${legal.length} 张`)
  console.log(`   ❌ 非法来源：${illegal.length} 张`)

  if (illegal.length > 0) {
    console.log(`\n⚠️ 非法来源图片详情：`)
    console.log('-'.repeat(60))

    // 按域名分组
    const byDomain = new Map<string, AuditResult[]>()
    for (const item of illegal) {
      const list = byDomain.get(item.domain) || []
      list.push(item)
      byDomain.set(item.domain, list)
    }

    // 按数量排序
    const sortedDomains = [...byDomain.entries()].sort((a, b) => b[1].length - a[1].length)

    for (const [domain, items] of sortedDomains) {
      console.log(`\n🔴 ${domain} (${items.length} 张)`)
      for (const item of items.slice(0, 5)) {
        console.log(`   - ${item.title.slice(0, 40)}...`)
        console.log(`     ID: ${item.articleId}`)
      }
      if (items.length > 5) {
        console.log(`   ... 还有 ${items.length - 5} 张`)
      }
    }
  }

  // 合法来源分布
  console.log(`\n✅ 合法来源分布：`)
  const legalBySource = new Map<string, number>()
  for (const item of legal) {
    const count = legalBySource.get(item.source) || 0
    legalBySource.set(item.source, count + 1)
  }
  for (const [source, count] of legalBySource) {
    console.log(`   ${source}: ${count} 张`)
  }
}

async function cleanIllegalImages(results: AuditResult[]) {
  const illegal = results.filter(r => !r.isLegal)

  if (illegal.length === 0) {
    console.log('\n✅ 没有需要清理的非法图片')
    return
  }

  console.log(`\n🧹 开始清理 ${illegal.length} 张非法图片...`)

  let cleaned = 0
  let failed = 0

  for (const item of illegal) {
    try {
      // 将封面图设为 null，后续可以用 AI 重新生成
      const { error } = await supabase
        .from('generated_articles')
        .update({
          cover_image: null,
          // 添加标记，表示需要重新生成封面
          // image_credit: 'NEEDS_REGENERATION'
        })
        .eq('id', item.articleId)

      if (error) {
        console.error(`   ❌ 清理失败 ${item.articleId}: ${error.message}`)
        failed++
      } else {
        console.log(`   ✅ 已清理: ${item.title.slice(0, 40)}...`)
        cleaned++
      }
    } catch (err) {
      console.error(`   ❌ 清理异常 ${item.articleId}:`, err)
      failed++
    }
  }

  console.log(`\n📊 清理结果：`)
  console.log(`   ✅ 成功：${cleaned} 张`)
  console.log(`   ❌ 失败：${failed} 张`)
}

async function main() {
  const args = process.argv.slice(2)
  const shouldClean = args.includes('--clean')

  console.log('🚀 图片来源审计工具')
  console.log('='.repeat(60))

  if (shouldClean) {
    console.log('⚠️ 清理模式已启用，将删除非法来源的图片 URL')
  } else {
    console.log('📖 仅审计模式，不会修改数据库')
    console.log('   使用 --clean 参数启用清理模式')
  }

  const results = await auditImageSources()
  printReport(results)

  if (shouldClean) {
    await cleanIllegalImages(results)
  }

  console.log('\n✅ 审计完成')
}

main().catch(console.error)
