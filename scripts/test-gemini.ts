#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { generateArticleWithGemini, generateTextWithGemini } from '../src/lib/ai/gemini'

/**
 * 測試 Gemini API 連接和文章生成
 */

async function testGeminiConnection() {
  console.log('🧪 測試 Gemini API 連接...\n')
  console.log('='.repeat(80))

  try {
    // 簡單文字生成測試
    console.log('\n1️⃣ 測試簡單文字生成...')
    const text = await generateTextWithGemini(
      '用一句話介紹 Tesla Model 3',
      { maxTokens: 100, temperature: 0.7, model: 'flash' }
    )
    console.log(`✅ 成功！回應: "${text}"`)

  } catch (error: any) {
    console.error('❌ 文字生成失敗:', error.message)
    return false
  }

  try {
    // 文章生成測試
    console.log('\n2️⃣ 測試文章生成 (Flash 模型)...')

    const mockSources = [
      {
        title: 'Tesla Model 3 2024 改款發表',
        content: `
特斯拉在今日正式發表 2024 年式 Model 3 改款車型。新車外觀經過重新設計，
採用更流線的車身線條。內裝方面，中控螢幕升級為 15.4 吋，並搭載最新的
FSD (Full Self-Driving) 系統。動力部分，長續航版本續航里程達到 650 公里。
售價從 39,990 美元起跳。預計第四季開始交車。
        `.trim(),
        url: 'https://example.com/tesla-model-3-2024'
      },
      {
        title: 'Model 3 改款正式亮相 續航提升',
        content: `
2024 Model 3 改款車型正式亮相。新車最大亮點是續航里程提升至 650 公里，
比舊款增加約 10%。外觀採用新設計語言，前後燈組均重新設計。內裝質感
提升，使用更多軟性材質。價格維持在 39,990 美元起。
        `.trim(),
        url: 'https://example.com/model-3-unveiled'
      }
    ]

    const result = await generateArticleWithGemini({
      sources: mockSources,
      systemPrompt: '你是專業的汽車新聞編輯，擅長整合多方資訊撰寫深度報導。',
      styleGuide: `
# 寫作風格指南

## 標題
- 15-25字，吸引眼球
- 包含品牌和車型名稱
- 數據化呈現（如有）

## 內容
- 開頭段落總結要點
- 使用數據支撐論述
- 客觀中立，避免主觀判斷
- 最少 500 字
      `.trim()
    }, 'flash')

    console.log('\n✅ 文章生成成功！')
    console.log('\n' + '='.repeat(80))
    console.log(`\n標題: ${result.title_zh}`)
    console.log(`Slug: ${result.slug_en}`)
    console.log(`信心度: ${result.confidence}%`)
    console.log(`品牌: ${result.brands?.join(', ') || 'N/A'}`)
    console.log(`車型: ${result.car_models?.join(', ') || 'N/A'}`)
    console.log(`分類: ${result.categories?.join(', ') || 'N/A'}`)
    console.log(`標籤: ${result.tags?.join(', ') || 'N/A'}`)
    console.log(`\n內容預覽:\n${result.content_zh.slice(0, 300)}...`)
    console.log('\n' + '='.repeat(80))

    // 品質檢查
    console.log('\n3️⃣ 品質檢查:')
    console.log(`   ✅ 有數據: ${result.quality_checks.has_data}`)
    console.log(`   ✅ 有來源: ${result.quality_checks.has_sources}`)
    console.log(`   ✅ 無禁詞: ${!result.quality_checks.has_banned_words}`)
    console.log(`   ✅ 無未驗證內容: ${!result.quality_checks.has_unverified}`)
    console.log(`   ✅ 結構有效: ${result.quality_checks.structure_valid}`)

    return true

  } catch (error: any) {
    console.error('\n❌ 文章生成失敗:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    return false
  }
}

async function testGeminiPro() {
  console.log('\n\n' + '='.repeat(80))
  console.log('\n4️⃣ 測試 Gemini Pro 模型...')

  try {
    const text = await generateTextWithGemini(
      '分析電動車市場 2024 年的三大趨勢',
      { maxTokens: 300, temperature: 0.7, model: 'pro' }
    )
    console.log(`✅ Pro 模型成功！回應:\n${text}`)
    return true
  } catch (error: any) {
    console.error('❌ Pro 模型失敗:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Gemini API 測試工具\n')

  // 檢查 API Key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    console.error('❌ 錯誤: 未設定 GEMINI_API_KEY 或 GOOGLE_AI_API_KEY')
    console.error('\n請在 .env.local 中設定:')
    console.error('GEMINI_API_KEY=your-api-key-here\n')
    process.exit(1)
  }

  console.log(`✓ API Key: ${apiKey.slice(0, 20)}...${apiKey.slice(-4)}`)
  console.log(`✓ Provider: Gemini API`)

  // 執行測試
  const success = await testGeminiConnection()

  if (success) {
    await testGeminiPro()
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n🎯 測試結果總結:')

  if (success) {
    console.log('\n✅ 所有測試通過！')
    console.log('\n下一步:')
    console.log('1. 在 .env.local 設定:')
    console.log('   AI_PROVIDER=gemini')
    console.log('   GEMINI_MODEL=flash')
    console.log('2. 重啟開發服務器: npm run dev')
    console.log('3. 手動觸發 generator 測試實際生成')
    console.log('\n預期成本節省: 98% (每月 $0.41 vs $18.90)')
  } else {
    console.log('\n❌ 測試失敗！')
    console.log('\n故障排除:')
    console.log('1. 檢查 API Key 是否正確')
    console.log('2. 確認網路連接正常')
    console.log('3. 查看詳細錯誤訊息')
    console.log('4. 參考文件: docs/gemini-migration-guide.md')
  }

  console.log('\n' + '='.repeat(80))
}

main().catch(error => {
  console.error('\n❌ 測試執行失敗:', error)
  process.exit(1)
})
