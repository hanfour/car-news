/**
 * 圖片浮水印工具
 * 為 AI 生成的圖片添加「AI 生成模擬」浮水印
 */

import sharp from 'sharp'
import { getErrorMessage } from '@/lib/utils/error'

interface WatermarkOptions {
  text?: string
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
): Promise<any> {
  const {
    text = 'AI 生成模擬圖',
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
      fontSize
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
 * 創建浮水印 SVG
 */
function createWatermarkSvg(
  text: string,
  imageWidth: number,
  imageHeight: number,
  position: string,
  opacity: number,
  fontSize: number
): string {
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

  // 創建帶有陰影效果的 SVG 浮水印
  return `
    <svg width="${imageWidth}" height="${imageHeight}">
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
        x="${x - (position.includes('right') ? 220 : 10)}"
        y="${y - fontSize - 10}"
        width="230"
        height="${fontSize + 20}"
        fill="black"
        opacity="${opacity * 0.5}"
        rx="5"
      />

      <!-- 浮水印文字 -->
      <text
        x="${x}"
        y="${y}"
        font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="white"
        opacity="${opacity}"
        text-anchor="${textAnchor}"
        filter="url(#shadow)"
      >${text}</text>

      <!-- 小字說明 -->
      <text
        x="${x}"
        y="${y + 25}"
        font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
        font-size="${fontSize * 0.4}"
        fill="white"
        opacity="${opacity * 0.8}"
        text-anchor="${textAnchor}"
      >此圖片由 AI 生成，僅供參考</text>
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
): Promise<any> {
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
