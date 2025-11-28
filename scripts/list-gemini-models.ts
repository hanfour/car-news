#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

/**
 * 列出 Gemini API 中可用的模型
 */

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY

  if (!apiKey) {
    console.error('❌ 未設定 GEMINI_API_KEY')
    process.exit(1)
  }

  console.log('🔍 查詢可用的 Gemini 模型...\n')
  console.log(`API Key: ${apiKey.slice(0, 20)}...${apiKey.slice(-4)}\n`)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API 請求失敗:', error)
      process.exit(1)
    }

    const data = await response.json()

    console.log(`找到 ${data.models?.length || 0} 個模型:\n`)

    if (data.models) {
      for (const model of data.models) {
        console.log(`📦 ${model.name}`)
        console.log(`   Display Name: ${model.displayName}`)
        console.log(`   Description: ${model.description}`)
        console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`)
        console.log(`   Input Token Limit: ${model.inputTokenLimit || 'N/A'}`)
        console.log(`   Output Token Limit: ${model.outputTokenLimit || 'N/A'}`)
        console.log('')
      }
    }

  } catch (error: any) {
    console.error('❌ 錯誤:', error.message)
    process.exit(1)
  }
}

listModels()
