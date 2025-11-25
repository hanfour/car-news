/**
 * AI 圖片生成工具
 * 使用 DALL-E 3 為沒有圖片的文章生成封面圖
 */

import OpenAI from 'openai'

// Lazy initialization to ensure env vars are loaded first
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

interface ImageGenerationResult {
  url: string
  revisedPrompt?: string
  error?: string
}

/**
 * 為汽車新聞生成封面圖片
 */
export async function generateCoverImage(
  title: string,
  content: string,
  brands?: string[]
): Promise<ImageGenerationResult | null> {
  try {
    // 構建圖片生成提示詞
    const prompt = buildImagePrompt(title, content, brands)

    console.log('→ Generating cover image with DALL-E 3...')
    console.log(`   Prompt: ${prompt.slice(0, 100)}...`)

    const response = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024', // 橫向圖片，適合文章封面
      quality: 'standard', // 使用 standard 降低成本
      style: 'natural' // 自然風格，更適合新聞
    })

    const imageUrl = response.data?.[0]?.url
    const revisedPrompt = response.data?.[0]?.revised_prompt

    if (!imageUrl) {
      console.error('✗ DALL-E 3 returned no image URL')
      return null
    }

    console.log('✓ Image generated successfully')
    console.log(`   URL: ${imageUrl.slice(0, 60)}...`)

    return {
      url: imageUrl,
      revisedPrompt
    }

  } catch (error: any) {
    console.error('✗ Image generation failed:', error.message)
    return {
      url: '',
      error: error.message
    }
  }
}

/**
 * 分析文章內容，提取視覺關鍵詞
 */
function analyzeContentForVisuals(title: string, content: string): string {
  const contentPreview = content.slice(0, 500)
  const combined = `${title}. ${contentPreview}`.toLowerCase()

  const visualElements: string[] = []

  // 技術特徵
  if (combined.includes('電動') || combined.includes('ev') || combined.includes('electric')) {
    visualElements.push('showcasing electric vehicle charging port or EV badge')
  }
  if (combined.includes('氫') || combined.includes('hydrogen')) {
    visualElements.push('highlighting hydrogen fuel cell technology elements')
  }
  if (combined.includes('自動駕駛') || combined.includes('autonomous') || combined.includes('self-driving')) {
    visualElements.push('emphasizing autonomous driving sensors and cameras on the vehicle')
  }
  if (combined.includes('混合動力') || combined.includes('hybrid')) {
    visualElements.push('showing hybrid badging or blue eco-friendly accents')
  }

  // 車輛類型
  if (combined.includes('suv')) {
    visualElements.push('SUV body style with elevated ride height')
  } else if (combined.includes('轎車') || combined.includes('sedan')) {
    visualElements.push('sedan body style with sleek profile')
  } else if (combined.includes('跑車') || combined.includes('sports')) {
    visualElements.push('sports car with aggressive stance and low profile')
  } else if (combined.includes('皮卡') || combined.includes('truck')) {
    visualElements.push('pickup truck with cargo bed visible')
  }

  // 設計元素
  if (combined.includes('新設計') || combined.includes('改款') || combined.includes('facelift')) {
    visualElements.push('highlighting updated front grille and headlight design')
  }
  if (combined.includes('內裝') || combined.includes('interior')) {
    visualElements.push('interior shot showing dashboard, seats, and center console')
  }
  if (combined.includes('螢幕') || combined.includes('display') || combined.includes('屏幕')) {
    visualElements.push('featuring large touchscreen display')
  }

  // 性能相關
  if (combined.includes('性能') || combined.includes('performance') || combined.includes('馬力')) {
    visualElements.push('dynamic action shot suggesting speed and performance')
  }
  if (combined.includes('越野') || combined.includes('off-road')) {
    visualElements.push('off-road setting with rugged terrain')
  }

  // 事件類型
  if (combined.includes('發表') || combined.includes('推出') || combined.includes('debut') || combined.includes('launch')) {
    visualElements.push('dramatic reveal presentation setting or auto show environment')
  }
  if (combined.includes('測試') || combined.includes('test')) {
    visualElements.push('testing environment or track setting')
  }
  if (combined.includes('量產') || combined.includes('production')) {
    visualElements.push('production-ready vehicle in studio setting')
  }

  // 顏色提示
  if (combined.includes('白色') || combined.includes('white')) {
    visualElements.push('white or pearl white exterior color')
  } else if (combined.includes('黑色') || combined.includes('black')) {
    visualElements.push('black or midnight black exterior color')
  } else if (combined.includes('藍色') || combined.includes('blue')) {
    visualElements.push('blue metallic exterior color')
  } else if (combined.includes('紅色') || combined.includes('red')) {
    visualElements.push('red or crimson exterior color')
  }

  return visualElements.length > 0
    ? visualElements.join(', ')
    : 'modern design with clean lines and contemporary styling'
}

/**
 * 構建圖片生成提示詞
 * 優化以生成更逼真、更少 AI 痕跡的圖片
 */
function buildImagePrompt(
  title: string,
  content: string,
  brands?: string[]
): string {
  // 分析內容提取視覺關鍵詞
  const visualContext = analyzeContentForVisuals(title, content)

  // 基礎提示詞 - 強調真實攝影感
  let prompt = `IMPORTANT: Create a hyper-realistic photograph that looks like it was taken by a professional automotive photographer with a high-end DSLR camera. `
  prompt += `This must look like a real photograph, NOT a 3D render or AI-generated image. `

  // 品牌信息
  if (brands && brands.length > 0) {
    const brandName = brands[0]
    prompt += `Subject: ${brandName} vehicle. `
  } else {
    prompt += `Subject: Modern luxury automobile. `
  }

  // 場景描述 - 基於標題和內容分析
  prompt += `Article context: ${title}. `
  prompt += `Visual elements to emphasize: ${visualContext}. `

  // 攝影技術細節 - 讓圖片更真實
  prompt += `Photography specs: `
  prompt += `Shot with Canon EOS R5 or Sony A7R IV. `
  prompt += `85mm f/1.4 lens for portrait shots or 24-70mm f/2.8 for wide angles. `
  prompt += `Natural lighting with subtle reflections. `
  prompt += `Shallow depth of field (f/2.8-f/4) with natural bokeh. `
  prompt += `ISO 100-400 for clean, noise-free image. `

  // 環境和光線
  prompt += `Setting: `
  prompt += `Professional studio with controlled lighting OR outdoor location with golden hour lighting. `
  prompt += `Clean, uncluttered background. `
  prompt += `Subtle environmental reflections on car surface. `
  prompt += `Natural shadows and highlights. `

  // 細節要求 - 避免 AI 痕跡
  prompt += `Critical details: `
  prompt += `Perfect panel gaps and body alignment. `
  prompt += `Realistic tire tread and wheel details. `
  prompt += `Accurate brand-specific design elements. `
  prompt += `Natural wear on surfaces (subtle dust, realistic reflections). `
  prompt += `Correct perspective and proportions. `
  prompt += `No distorted text or logos. `
  prompt += `No impossible reflections or physics. `
  prompt += `No overly smooth or plastic-looking surfaces. `

  // 後期處理風格
  prompt += `Post-processing: `
  prompt += `Subtle color grading like professional automotive photography. `
  prompt += `Natural contrast, not over-saturated. `
  prompt += `Slight vignette if appropriate. `
  prompt += `Film grain texture for authenticity (very subtle). `

  // 禁止元素
  prompt += `AVOID: `
  prompt += `No text, watermarks, logos, or captions. `
  prompt += `No overly perfect symmetry. `
  prompt += `No obvious 3D render look. `
  prompt += `No unnatural lighting or impossible reflections. `
  prompt += `No distorted wheels or panels. `

  // DALL-E 3 有 4000 字符限制
  return prompt.slice(0, 3900)
}

/**
 * 生成並持久化存儲封面圖片
 * 自動將 DALL-E 3 生成的圖片上傳到 Supabase Storage
 */
export async function generateAndSaveCoverImage(
  title: string,
  content: string,
  brands?: string[]
): Promise<{ url: string; credit: string } | null> {
  // 1. 生成圖片
  const result = await generateCoverImage(title, content, brands)

  if (!result || !result.url) {
    return null
  }

  // 2. 上傳到持久化存儲
  const { uploadImageFromUrl } = await import('@/lib/storage/image-uploader')

  // 生成有意義的文件名
  const timestamp = Date.now()
  const brandPrefix = brands && brands.length > 0 ? brands[0].toLowerCase() : 'auto'
  const fileName = `ai-${brandPrefix}-${timestamp}`

  console.log('→ Uploading AI-generated image to permanent storage...')
  const permanentUrl = await uploadImageFromUrl(result.url, fileName, true) // 啟用浮水印

  if (!permanentUrl) {
    console.warn('⚠ Failed to upload to storage, using temporary DALL-E URL')
    return {
      url: result.url,
      credit: 'AI Generated (DALL-E 3) - Temporary URL'
    }
  }

  console.log('✓ Image saved to permanent storage')
  return {
    url: permanentUrl,
    credit: 'AI Generated (DALL-E 3)'
  }
}
