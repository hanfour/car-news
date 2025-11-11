/**
 * 品牌提取工具
 * 從文章標題和內容中識別汽車品牌
 */

// 主要汽車品牌列表（按知名度排序）
const CAR_BRANDS = [
  // 美國品牌
  'Tesla', 'Ford', 'Chevrolet', 'GMC', 'Cadillac', 'Jeep', 'Dodge', 'Ram',
  'Lincoln', 'Buick', 'Chrysler', 'Rivian', 'Lucid',

  // 德國品牌
  'Mercedes-Benz', 'Mercedes', 'BMW', 'Audi', 'Volkswagen', 'VW', 'Porsche',
  'Opel', 'Smart',

  // 日本品牌
  'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Suzuki',
  'Lexus', 'Infiniti', 'Acura',

  // 韓國品牌
  'Hyundai', 'Kia', 'Genesis',

  // 中國品牌
  'BYD', 'NIO', 'XPeng', 'Xiaopeng', 'Li Auto', 'Geely', 'Great Wall',
  'Chery', 'GAC', 'SAIC', 'Hongqi', 'Lynk & Co', 'WEY', 'Ora', 'Zeekr',
  'Avatr', 'Aion', 'Neta', 'Leapmotor', 'Voyah', 'IM Motors',

  // 歐洲其他品牌
  'Volvo', 'Polestar', 'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo',
  'Fiat', 'Peugeot', 'Renault', 'Citroën', 'Skoda', 'Seat',

  // 英國品牌
  'Rolls-Royce', 'Bentley', 'Jaguar', 'Land Rover', 'Range Rover', 'Aston Martin',
  'McLaren', 'Lotus', 'Mini', 'MG',

  // 其他
  'Tata', 'Mahindra'
]

// 品牌別名映射（用於標準化）
const BRAND_ALIASES: Record<string, string> = {
  'VW': 'Volkswagen',
  'Xiaopeng': 'XPeng',
  'Benz': 'Mercedes-Benz',
  '特斯拉': 'Tesla',
  '比亞迪': 'BYD',
  '蔚來': 'NIO',
  '小鵬': 'XPeng',
  '理想': 'Li Auto',
  '寶馬': 'BMW',
  '奔驰': 'Mercedes-Benz',
  '奔馳': 'Mercedes-Benz',
  '奧迪': 'Audi',
  '大眾': 'Volkswagen',
  '豐田': 'Toyota',
  '本田': 'Honda',
  '現代': 'Hyundai',
  '起亞': 'Kia',
}

/**
 * 從文本中提取品牌
 */
export function extractBrands(text: string): string[] {
  const foundBrands = new Set<string>()
  const lowerText = text.toLowerCase()

  // 檢查每個品牌
  for (const brand of CAR_BRANDS) {
    const lowerBrand = brand.toLowerCase()

    // 使用單詞邊界確保完整匹配
    const regex = new RegExp(`\\b${lowerBrand}\\b`, 'i')

    if (regex.test(text)) {
      // 標準化品牌名稱
      const standardBrand = BRAND_ALIASES[brand] || brand
      foundBrands.add(standardBrand)
    }
  }

  // 檢查中文品牌名
  for (const [alias, standard] of Object.entries(BRAND_ALIASES)) {
    if (text.includes(alias)) {
      foundBrands.add(standard)
    }
  }

  return Array.from(foundBrands)
}

/**
 * 從文章中提取主要品牌
 * 優先順序：標題 > 內容開頭
 */
export function extractPrimaryBrand(title: string, content: string): string | null {
  // 先從標題提取
  const titleBrands = extractBrands(title)
  if (titleBrands.length > 0) {
    return titleBrands[0]
  }

  // 從內容前500字提取
  const contentStart = content.slice(0, 500)
  const contentBrands = extractBrands(contentStart)
  if (contentBrands.length > 0) {
    return contentBrands[0]
  }

  return null
}

/**
 * 按品牌分組文章
 */
export function groupArticlesByBrand<T extends { title: string; content: string }>(
  articles: T[]
): Map<string, T[]> {
  const brandGroups = new Map<string, T[]>()

  for (const article of articles) {
    const brand = extractPrimaryBrand(article.title, article.content)

    if (brand) {
      if (!brandGroups.has(brand)) {
        brandGroups.set(brand, [])
      }
      brandGroups.get(brand)!.push(article)
    } else {
      // 未識別品牌的放入 "Other" 組
      if (!brandGroups.has('Other')) {
        brandGroups.set('Other', [])
      }
      brandGroups.get('Other')!.push(article)
    }
  }

  return brandGroups
}
