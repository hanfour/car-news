import { NextResponse } from 'next/server'
import { generateAndSaveCoverImage } from '@/lib/ai/image-generation'

export async function GET() {
  const testTitle = 'BMW 發表全新 iX5 氫能源電動車'
  const testContent = `
    BMW 今日在慕尼黑總部發表全新 iX5 Hydrogen 氫能源電動車，
    這是BMW首款採用氫燃料電池技術的量產車型。新車搭載第五代 eDrive 技術，
    並整合了豐田提供的氫燃料電池系統。BMW董事會成員表示，
    氫能源將成為未來零排放移動的重要選項之一。
  `
  const testBrands = ['BMW']

  console.log('='.repeat(60))
  console.log('Testing AI image generation + storage...')
  console.log('='.repeat(60))

  const startTime = Date.now()
  const result = await generateAndSaveCoverImage(testTitle, testContent, testBrands)
  const duration = Date.now() - startTime

  console.log('='.repeat(60))
  console.log(`Test completed in ${duration}ms`)
  console.log('='.repeat(60))

  if (!result) {
    return NextResponse.json({
      success: false,
      error: 'Image generation or upload failed',
      duration
    })
  }

  return NextResponse.json({
    success: true,
    permanentUrl: result.url,
    credit: result.credit,
    duration,
    testData: {
      title: testTitle,
      brands: testBrands
    },
    note: 'This image is now permanently stored in Supabase Storage'
  })
}
