/**
 * 圖片浮水印工具
 * 為 AI 生成的圖片添加「AI 生成模擬」浮水印
 */

import sharp from 'sharp'
import { getErrorMessage } from '@/lib/utils/error'

interface WatermarkOptions {
  text?: string
  subText?: string | null  // 副標題，設為 null 則不顯示
  position?: 'bottom-right' | 'bottom-left' | 'center' | 'top-right'
  opacity?: number
  fontSize?: number
}

/**
 * 為圖片添加浮水印
 */
export async function addWatermark(
  imageBuffer: Buffer,
  options: WatermarkOptions = {}
): Promise<Buffer> {
  const {
    text = 'AI Generated',  // 使用英文避免 Vercel 無中文字體問題
    subText = 'For illustration only',
    position = 'bottom-right',
    opacity = 0.6,
    fontSize = 40
  } = options

  try {
    // 1. 獲取圖片尺寸
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 1792
    const height = metadata.height || 1024

    // 2. 創建浮水印 SVG
    const watermarkSvg = createWatermarkSvg(
      text,
      width,
      height,
      position,
      opacity,
      fontSize,
      subText
    )

    // 3. 合成圖片
    const watermarkedBuffer = await image
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          gravity: getGravity(position)
        }
      ])
      .png() // 輸出為 PNG 以保持質量
      .toBuffer()

    console.log(`✓ Watermark added: "${text}"`)
    return watermarkedBuffer

  } catch (error) {
    console.error('✗ Watermark failed:', getErrorMessage(error))
    // 如果浮水印失敗，返回原圖
    return imageBuffer
  }
}

/**
 * 跳脫 XML/SVG 特殊字元
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 創建浮水印 SVG
 */
function createWatermarkSvg(
  text: string,
  imageWidth: number,
  imageHeight: number,
  position: string,
  opacity: number,
  fontSize: number,
  subText?: string | null
): string {
  // 跳脫特殊字元避免破壞 SVG
  const safeText = escapeXml(text)
  const safeSubText = subText ? escapeXml(subText) : null
  // 計算文字位置
  const padding = 30
  let x = padding
  let y = imageHeight - padding

  switch (position) {
    case 'bottom-right':
      x = imageWidth - padding
      y = imageHeight - padding
      break
    case 'bottom-left':
      x = padding
      y = imageHeight - padding
      break
    case 'top-right':
      x = imageWidth - padding
      y = padding + fontSize
      break
    case 'center':
      x = imageWidth / 2
      y = imageHeight / 2
      break
  }

  const textAnchor = position.includes('right') ? 'end' : 'start'

  // 計算背景矩形大小（根據文字長度動態調整）
  // 使用原始 text 計算長度，因為跳脫後的字元會變長
  const textWidth = Math.max(text.length * fontSize * 0.6, 200)
  const rectHeight = safeSubText ? fontSize + 45 : fontSize + 20

  // 創建帶有陰影效果的 SVG 浮水印
  return `
<svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="2" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- 背景半透明矩形 -->
      <rect
        x="${x - (position.includes('right') ? textWidth + 10 : 10)}"
        y="${y - fontSize - 10}"
        width="${textWidth + 20}"
        height="${rectHeight}"
        fill="black"
        opacity="${opacity * 0.5}"
        rx="5"
      />

      <!-- 浮水印文字（使用 Vercel Linux 上可用的字體）-->
      <text
        x="${x}"
        y="${y}"
        font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="white"
        opacity="${opacity}"
        text-anchor="${textAnchor}"
        filter="url(#shadow)"
      >${safeText}</text>

      ${safeSubText ? `
      <!-- 小字說明 -->
      <text
        x="${x}"
        y="${y + 25}"
        font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
        font-size="${fontSize * 0.4}"
        fill="white"
        opacity="${opacity * 0.8}"
        text-anchor="${textAnchor}"
      >${safeSubText}</text>
      ` : ''}
    </svg>
  `
}

/**
 * 獲取 sharp 的 gravity 參數
 */
function getGravity(position: string): string {
  switch (position) {
    case 'bottom-right':
      return 'southeast'
    case 'bottom-left':
      return 'southwest'
    case 'top-right':
      return 'northeast'
    case 'center':
      return 'center'
    default:
      return 'southeast'
  }
}

/**
 * 從 URL 下載圖片並添加浮水印
 */
export async function downloadAndAddWatermark(
  imageUrl: string,
  watermarkOptions?: WatermarkOptions
): Promise<Buffer> {
  // 1. 下載圖片
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const imageBuffer = Buffer.from(arrayBuffer)

  // 2. 添加浮水印
  const watermarkedBuffer = await addWatermark(imageBuffer, watermarkOptions)

  return watermarkedBuffer
}
