#!/usr/bin/env tsx

/**
 * 修复文章中的禁止标题格式
 *
 * 移除以下格式：
 * - ### 第一段：導語
 * - ### 第二段：背景分析
 * - ### 第三段：多元視角
 * - 等类似的段落标题
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 需要移除的标题模式（更全面的匹配）
const PATTERNS_TO_REMOVE = [
  // 段落编号格式
  /^###?\s*第[一二三四五六七八九十]段[：:].+$/gm,

  // ### 标题格式（可能带副标题）
  /^###\s*(導語|背景分析|背景|多元視角|分析視角|分析|數據呈現|消費者視角|消費者|結語|總結|展望|觀點).*$/gm,

  // ## 标题格式（可能带副标题）
  /^##\s*(導語|背景分析|背景|多元視角|分析視角|分析|數據呈現|消費者視角|消費者|結語|總結|展望|觀點).*$/gm,

  // **粗体标题** 格式（独立成行）
  /^\*\*(導語|背景分析|背景|多元視角|分析視角|分析|數據呈現|消費者視角|消費者|結語|總結|展望|觀點)\*\*\s*$/gm,

  // 【标题】格式
  /^【(導語|背景分析|背景|多元視角|分析視角|分析|數據呈現|消費者視角|消費者|結語|總結|展望|觀點)】\s*$/gm,

  // 标题: 格式（独立成行）
  /^(導語|背景分析|多元視角|分析視角|數據呈現|消費者視角|結語|總結)[：:]\s*$/gm,

  // 移除连续的空行（超过2行）
  /\n{3,}/g,
]

function cleanContent(content: string, title: string): string {
  let cleaned = content

  // 1. 移除开头的重复标题（### 或 ## 开头的第一行）
  // 如果第一行是 ### xxx 或 ## xxx 格式，移除它
  cleaned = cleaned.replace(/^###?\s+.+\n+/, '')

  // 2. 应用其他模式清理
  for (const pattern of PATTERNS_TO_REMOVE) {
    cleaned = cleaned.replace(pattern, '\n')
  }

  // 3. 清理多余的换行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // 4. 确保开头没有多余换行
  cleaned = cleaned.trim()

  return cleaned
}

async function main() {
  const args = process.argv.slice(2)
  const shouldRun = args.includes('--run')

  console.log('🔧 文章格式修复工具\n')
  console.log('='.repeat(60))

  // 获取所有文章
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, content_zh')
    .eq('published', true)

  if (error) {
    console.error('❌ 获取文章失败:', error.message)
    process.exit(1)
  }

  // 检查哪些文章需要修复
  const needsFix: Array<{ id: string; title: string; original: string; cleaned: string }> = []

  for (const article of articles) {
    const cleaned = cleanContent(article.content_zh, article.title_zh)
    if (cleaned !== article.content_zh) {
      needsFix.push({
        id: article.id,
        title: article.title_zh,
        original: article.content_zh,
        cleaned
      })
    }
  }

  console.log(`\n📊 扫描结果:`)
  console.log(`   总文章数: ${articles.length}`)
  console.log(`   需要修复: ${needsFix.length}`)

  if (needsFix.length === 0) {
    console.log('\n✅ 没有需要修复的文章')
    return
  }

  console.log(`\n📝 需要修复的文章:`)
  for (const article of needsFix.slice(0, 10)) {
    console.log(`   - ${article.id}: ${article.title.slice(0, 40)}...`)
  }
  if (needsFix.length > 10) {
    console.log(`   ... 还有 ${needsFix.length - 10} 篇`)
  }

  if (!shouldRun) {
    console.log('\n' + '='.repeat(60))
    console.log('📖 预览模式 - 不会修改数据库')
    console.log('使用 --run 参数执行实际修复')

    // 显示第一篇文章的修复预览
    if (needsFix.length > 0) {
      const preview = needsFix[0]
      console.log('\n--- 修复预览 (第一篇) ---')
      console.log('原文前 500 字:')
      console.log(preview.original.slice(0, 500))
      console.log('\n修复后前 500 字:')
      console.log(preview.cleaned.slice(0, 500))
    }
    return
  }

  // 执行修复
  console.log('\n' + '='.repeat(60))
  console.log('🔧 开始修复...\n')

  let success = 0
  let failed = 0

  for (const article of needsFix) {
    const { error: updateError } = await supabase
      .from('generated_articles')
      .update({ content_zh: article.cleaned })
      .eq('id', article.id)

    if (updateError) {
      console.error(`   ❌ ${article.id}: ${updateError.message}`)
      failed++
    } else {
      console.log(`   ✅ ${article.id}: ${article.title.slice(0, 40)}...`)
      success++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 修复结果:`)
  console.log(`   ✅ 成功: ${success}`)
  console.log(`   ❌ 失败: ${failed}`)
  console.log('\n✅ 完成！')
}

main().catch(error => {
  console.error('\n❌ 执行失败:', error)
  process.exit(1)
})
