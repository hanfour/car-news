#!/usr/bin/env tsx

/**
 * 相似度检测功能测试
 *
 * 测试场景：
 * 1. 高相似度文本（应该不通过）
 * 2. 低相似度文本（应该通过）
 * 3. 真实文章生成测试
 */

import {
  checkContentSimilarity,
  findMostSimilarSource,
  formatSimilarityReport
} from '../src/lib/utils/similarity-checker'

// 测试用例 1：高相似度（直接复制）
const testCase1 = {
  name: '高相似度 - 直接复制',
  source: `
特斯拉今天宣布 Model 3 降价 5000 美元，基础版售价降至 34990 美元。
这是特斯拉今年第二次大幅降价，旨在提高市场竞争力。
CEO 马斯克表示，生产效率的提升使得降价成为可能。
新价格即日起在美国市场生效，预计交付时间为 2-4 周。
  `.trim(),
  generated: `
特斯拉今天宣布 Model 3 降价 5000 美元，基础版售价降至 34990 美元。
这是特斯拉今年第二次大幅降价，目的是提高市场竞争力。
马斯克表示，生产效率的提升使得这次降价成为可能。
新价格即日起在美国市场生效，预计交付时间为 2-4 周。
  `.trim(),
  expectCompliant: false
}

// 测试用例 2：低相似度（完全重写）
const testCase2 = {
  name: '低相似度 - 完全重写',
  source: `
特斯拉今天宣布 Model 3 降价 5000 美元，基础版售价降至 34990 美元。
这是特斯拉今年第二次大幅降价，旨在提高市场竞争力。
CEO 马斯克表示，生产效率的提升使得降价成为可能。
新价格即日起在美国市场生效，预计交付时间为 2-4 周。
  `.trim(),
  generated: `
根據最新消息，電動車龍頭特斯拉針對入門車款進行價格調整。

Model 3 基礎版本售價下調約 12.5%，目前美國消費者可以用不到 3.5 萬美元的價格入手這款熱門電動轎車。

對於台灣消費者而言，這次降價可能預示著國內市場也將迎來價格調整。根據過往經驗，美國市場的定價變動通常會在 1-2 個月內反映到其他市場。

規格方面，Model 3 標準版續航里程為 438 公里，0-100 加速 5.8 秒，對於日常通勤來說綽綽有餘。

---
📣 **深入了解**
本文資訊彙整自以下來源：
- 特斯拉官方新聞稿
  `.trim(),
  expectCompliant: true
}

// 测试用例 3：中等相似度（部分改写）
const testCase3 = {
  name: '中等相似度 - 部分改写',
  source: `
特斯拉今天宣布 Model 3 降价 5000 美元，基础版售价降至 34990 美元。
这是特斯拉今年第二次大幅降价，旨在提高市场竞争力。
CEO 马斯克表示，生产效率的提升使得降价成为可能。
新价格即日起在美国市场生效，预计交付时间为 2-4 周。
  `.trim(),
  generated: `
特斯拉 Model 3 再次調整價格，降幅達 5000 美元。

基礎版售價降至 34990 美元，這是今年內的第二次降價。特斯拉表示，生產效率提升是降價的主要原因。

新價格已在美國市場生效，交付時間約 2-4 週。

這對消費者意味著什麼？入門電動車的價格門檻再次降低，競爭對手將面臨更大壓力。
  `.trim(),
  expectCompliant: false // 边界情况，可能通过也可能不通过
}

function runTest(testCase: {
  name: string
  source: string
  generated: string
  expectCompliant: boolean
}) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧪 测试: ${testCase.name}`)
  console.log('='.repeat(60))

  const result = checkContentSimilarity(
    testCase.generated,
    [testCase.source]
  )

  console.log(formatSimilarityReport(result))

  const passed = result.isCompliant === testCase.expectCompliant
  console.log(`\n${passed ? '✅' : '❌'} 测试结果: ${passed ? '通过' : '失败'}`)
  console.log(`   预期: ${testCase.expectCompliant ? '合规' : '不合规'}`)
  console.log(`   实际: ${result.isCompliant ? '合规' : '不合规'}`)

  return passed
}

// 测试多来源场景
function testMultipleSources() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('🧪 测试: 多来源相似度检测')
  console.log('='.repeat(60))

  const sources = [
    {
      title: 'Tesla Price Cut Announcement',
      content: 'Tesla Model 3 base price reduced to $34,990...',
      url: 'https://example.com/1'
    },
    {
      title: 'Model 3 Gets Major Discount',
      content: 'The popular Tesla Model 3 sedan now starts at under $35,000...',
      url: 'https://example.com/2'
    }
  ]

  const generated = `
根據最新報導，特斯拉 Model 3 基礎版售價調整至 34990 美元。
這對電動車市場帶來重大影響，消費者購車成本進一步降低。
  `.trim()

  const { mostSimilar, allResults } = findMostSimilarSource(generated, sources)

  console.log('\n各来源相似度:')
  for (const r of allResults) {
    console.log(`  • ${r.title}: ${(r.similarity * 100).toFixed(1)}%`)
  }

  if (mostSimilar) {
    console.log(`\n最相似来源: ${mostSimilar.title} (${(mostSimilar.similarity * 100).toFixed(1)}%)`)
  }
}

async function main() {
  console.log('🚀 相似度检测功能测试\n')

  const tests = [testCase1, testCase2, testCase3]
  let passed = 0
  let failed = 0

  for (const test of tests) {
    if (runTest(test)) {
      passed++
    } else {
      failed++
    }
  }

  testMultipleSources()

  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 测试结果汇总')
  console.log('='.repeat(60))
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`📈 通过率: ${((passed / tests.length) * 100).toFixed(0)}%`)

  // 阈值测试
  console.log(`\n${'='.repeat(60)}`)
  console.log('📏 阈值敏感度测试')
  console.log('='.repeat(60))

  const thresholds = [0.2, 0.25, 0.3, 0.35, 0.4]
  for (const threshold of thresholds) {
    const result = checkContentSimilarity(testCase3.generated, [testCase3.source], threshold)
    console.log(`  阈值 ${threshold * 100}%: ${result.isCompliant ? '✅ 合规' : '❌ 不合规'} (实际 ${(result.overallSimilarity * 100).toFixed(1)}%)`)
  }
}

main().catch(console.error)
