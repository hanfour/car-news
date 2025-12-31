#!/usr/bin/env tsx

/**
 * 法律合规文章生成测试
 *
 * 测试新的 Prompt 是否符合以下要求：
 * 1. 角色定位：数据分析师，而非改写者
 * 2. 来源标注：文章开头标注来源
 * 3. 数据提取：专注客观数据
 * 4. 原创结构：不沿用来源的段落顺序
 * 5. 消费者分析：加入独家分析视角
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { generateArticleWithGemini } from '../src/lib/ai/gemini'
import { loadPrompts } from '../src/config/prompts'

// 模拟来源文章
const mockSources = [
  {
    title: 'Tesla Cuts Model 3 Prices by $5,000',
    content: `
Tesla has announced a significant price reduction for its popular Model 3 sedan.
The base Model 3 now starts at $34,990, down from $39,990 - a $5,000 decrease.
The Long Range variant drops to $42,990, while the Performance model is now $49,990.

CEO Elon Musk stated that improved manufacturing efficiency enabled these cuts.
The price changes are effective immediately across all U.S. markets.
Delivery times are estimated at 2-4 weeks for most configurations.

The Model 3 features a 15-inch touchscreen, 272 miles of range for the base model,
and 0-60 mph acceleration in 5.8 seconds. The Long Range offers 333 miles of range.

Analysts suggest this move is aimed at increasing market share amid growing competition
from legacy automakers entering the EV space.
    `.trim(),
    url: 'https://example.com/tesla-price-cut'
  },
  {
    title: 'Tesla Model 3 Gets Major Price Cut in Latest Move',
    content: `
In a surprise announcement, Tesla has slashed prices on its Model 3 lineup.
The entry-level Model 3 is now available for $34,990, representing a 12.5% reduction.

Industry experts believe this aggressive pricing strategy is Tesla's response to
increased competition from rivals like BYD, Hyundai, and traditional automakers.

The price cuts come as Tesla reported Q4 2024 deliveries of 484,507 vehicles,
slightly below expectations. The company aims to boost sales volume in 2025.

Specifications remain unchanged: the base Model 3 delivers 272 miles of EPA range,
powered by a single motor producing 283 horsepower.
    `.trim(),
    url: 'https://example.com/model-3-price-update'
  }
]

async function testLegalComplianceGeneration() {
  console.log('🧪 法律合规文章生成测试\n')
  console.log('='.repeat(80))

  // 加载真实的 prompts
  const prompts = loadPrompts()

  console.log('\n📋 使用的 Prompt 配置:')
  console.log('   System Prompt: 数据分析师角色')
  console.log('   Style Guide: 法律合规版')

  try {
    console.log('\n⏳ 生成文章中...\n')

    const result = await generateArticleWithGemini({
      sources: mockSources,
      systemPrompt: prompts.system,
      styleGuide: prompts.styleGuide
    }, 'flash')

    console.log('='.repeat(80))
    console.log('\n✅ 文章生成成功！\n')

    // 输出结果
    console.log(`📰 标题: ${result.title_zh}`)
    console.log(`🔗 Slug: ${result.slug_en}`)
    console.log(`📊 信心度: ${result.confidence}%`)
    console.log(`🏷️ 品牌: ${result.brands?.join(', ') || 'N/A'}`)
    console.log(`🚗 车型: ${result.car_models?.join(', ') || 'N/A'}`)
    console.log(`📁 分类: ${result.categories?.join(', ') || 'N/A'}`)
    console.log(`🏷️ 标签: ${result.tags?.join(', ') || 'N/A'}`)

    console.log('\n' + '-'.repeat(80))
    console.log('\n📝 完整内容:\n')
    console.log(result.content_zh)
    console.log('\n' + '-'.repeat(80))

    // 法律合规检查
    console.log('\n🔍 法律合规检查:\n')

    const content = result.content_zh

    // 检查1: 来源标注
    const hasSourceAtStart = content.includes('根據') ||
                              content.includes('來自') ||
                              content.includes('報導') ||
                              content.includes('資訊來源')
    console.log(`   ${hasSourceAtStart ? '✅' : '❌'} 来源标注: ${hasSourceAtStart ? '文章开头有来源标注' : '缺少来源标注'}`)

    // 检查2: 数据呈现
    const hasNumbers = /\$[\d,]+|\d+%|\d+\s*(公里|km|miles|萬|美元)/.test(content)
    console.log(`   ${hasNumbers ? '✅' : '❌'} 数据呈现: ${hasNumbers ? '包含价格/规格数据' : '缺少具体数据'}`)

    // 检查3: 消费者分析
    const hasAnalysis = content.includes('消費者') ||
                         content.includes('意味') ||
                         content.includes('影響') ||
                         content.includes('對於') ||
                         content.includes('值得') ||
                         content.includes('考慮')
    console.log(`   ${hasAnalysis ? '✅' : '❌'} 消费者分析: ${hasAnalysis ? '包含消费者视角分析' : '缺少消费者分析'}`)

    // 检查4: 来源链接
    const hasSourceLinks = content.includes('深入了解') ||
                            content.includes('原文') ||
                            content.includes('閱讀更多') ||
                            content.includes('來源')
    console.log(`   ${hasSourceLinks ? '✅' : '❌'} 来源链接: ${hasSourceLinks ? '文末有来源链接' : '缺少来源链接'}`)

    // 检查5: 禁止词汇
    const hasBannedWords = /震驚|瘋狂|顛覆|爆炸性|史上最強|完美|革命性/.test(content)
    console.log(`   ${!hasBannedWords ? '✅' : '❌'} 无禁止词: ${!hasBannedWords ? '未使用标题党用词' : '包含禁止词汇'}`)

    // 检查6: 表格使用（可选）
    const hasTable = content.includes('|') && content.includes('---')
    console.log(`   ${hasTable ? '✅' : '⚪'} 表格呈现: ${hasTable ? '使用表格展示规格' : '未使用表格（可选）'}`)

    // 计算总分
    const checks = [hasSourceAtStart, hasNumbers, hasAnalysis, hasSourceLinks, !hasBannedWords]
    const passed = checks.filter(Boolean).length
    const total = checks.length

    console.log('\n' + '='.repeat(80))
    console.log(`\n📊 合规评分: ${passed}/${total} (${Math.round(passed/total*100)}%)`)

    if (passed === total) {
      console.log('✅ 完全符合法律合规要求！')
    } else if (passed >= total - 1) {
      console.log('🟡 基本符合要求，有小幅改进空间')
    } else {
      console.log('❌ 需要调整 Prompt 以提高合规性')
    }

    // 相似度警告
    console.log('\n⚠️ 相似度提醒:')
    console.log('   请人工检查生成内容与来源的相似度')
    console.log('   建议使用 Copyscape 或类似工具进行检测')

    return true

  } catch (error: any) {
    console.error('\n❌ 文章生成失败:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    return false
  }
}

async function main() {
  console.log('🚀 法律合规测试工具\n')

  // 检查 API Key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    console.error('❌ 错误: 未设定 GEMINI_API_KEY 或 GOOGLE_AI_API_KEY')
    process.exit(1)
  }

  console.log(`✓ API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`)

  const success = await testLegalComplianceGeneration()

  console.log('\n' + '='.repeat(80))

  if (success) {
    console.log('\n✅ 测试完成！')
    console.log('\n下一步:')
    console.log('1. 检查生成内容的原创性')
    console.log('2. 确认来源标注是否清晰')
    console.log('3. 验证数据提取是否准确')
  } else {
    console.log('\n❌ 测试失败，请检查配置')
  }
}

main().catch(error => {
  console.error('\n❌ 执行失败:', error)
  process.exit(1)
})
