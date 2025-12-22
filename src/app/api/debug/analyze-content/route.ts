import { NextRequest, NextResponse } from 'next/server'
import { verifyDebugAccess } from '@/lib/admin/auth'

// 從 image-generation.ts 複製的分析函數（用於調試）
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

export async function GET(request: NextRequest) {
  const access = await verifyDebugAccess(request)
  if (!access.allowed) return access.response!

  const testTitle = 'BMW 發表全新 iX5 氫能源電動車'
  const testContent = `
    BMW 今日在慕尼黑總部發表全新 iX5 Hydrogen 氫能源電動車，
    這是BMW首款採用氫燃料電池技術的量產車型。新車搭載第五代 eDrive 技術，
    並整合了豐田提供的氫燃料電池系統。BMW董事會成員表示，
    氫能源將成為未來零排放移動的重要選項之一。
    車輛採用藍色金屬漆，並配備全新設計的水箱護罩。
  `

  const visualElements = analyzeContentForVisuals(testTitle, testContent)

  return NextResponse.json({
    title: testTitle,
    content: testContent.trim(),
    extractedVisualElements: visualElements,
    visualElementsArray: visualElements.split(', '),
    explanation: {
      '氫能源': 'Found "氫" keyword → adds hydrogen fuel cell elements',
      '發表': 'Found "發表" keyword → adds dramatic reveal presentation',
      '藍色': 'Found "藍色" keyword → specifies blue metallic color',
      '新設計': 'Found "新設計" keyword → highlights updated design',
      '電動': 'Not found in content → would add EV charging port if present'
    }
  })
}
