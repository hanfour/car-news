import { NextResponse } from 'next/server'
import { generateCoverImage } from '@/lib/ai/image-generation'

export async function GET() {
  const testTitle = '特斯拉推出全新 Model 3 高性能版本'
  const testContent = `
    特斯拉今天宣布推出全新 Model 3 Performance 高性能版本，
    配備升級的電池組和改良的懸吊系統。新車型 0-100 公里加速僅需 3.1 秒，
    最高時速達到 261 公里/小時。Tesla CEO 馬斯克表示，
    這是目前市場上性能最強大的電動轎車之一。
  `
  const testBrands = ['Tesla']

  console.log('Testing AI image generation...')
  const result = await generateCoverImage(testTitle, testContent, testBrands)

  return NextResponse.json({
    success: !!result?.url,
    imageUrl: result?.url,
    revisedPrompt: result?.revisedPrompt,
    error: result?.error,
    testData: {
      title: testTitle,
      brands: testBrands
    }
  })
}
