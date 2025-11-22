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

// 專門的機車品牌列表（出現即過濾）
const PURE_MOTORCYCLE_BRANDS = [
  'Harley-Davidson', 'Harley', 'Ducati', 'Yamaha', 'Kawasaki',
  'KTM', 'Triumph', 'Aprilia', 'Moto Guzzi', 'Husqvarna',
  'Royal Enfield', 'Indian', 'Victory', 'MV Agusta', 'Benelli', 'SYM',
  'Kymco', 'PGO', 'Gogoro',
  // 中文
  '哈雷', '杜卡迪', '川崎', '雅馬哈', '山葉', '光陽'
]

// 雙重品牌（汽車+機車，需要額外關鍵詞判斷）
// 這些品牌的文章不會直接被過濾，只有同時出現摩托車關鍵詞時才過濾
const DUAL_BRANDS = ['BMW', 'Honda', 'Suzuki', '本田', '鈴木']

// 機車關鍵詞（用於內容檢測）
// 移除太寬泛的詞：'cc', 'bike', '排氣量' 等會誤判汽車文章
const MOTORCYCLE_KEYWORDS = [
  // 中文關鍵詞
  '機車', '摩托車', '重機', '檔車', '速克達', '騎士', '二輪', '摩托', '電動機車',
  // 英文關鍵詞
  'motorcycle', 'motorbike', 'scooter',
  // 特定排量（加上 "motorcycle" 或中文才算）
  'MotoGP', 'EICMA',
  // 具體機車型號
  '125cc motorcycle', '150cc motorcycle', '250cc motorcycle', '600cc motorcycle', '1000cc motorcycle'
]

// 完全不相關的關鍵詞（用於過濾非汽車內容）
const IRRELEVANT_KEYWORDS = [
  // 政府/政治
  '政府停擺', 'government shutdown', 'FAA', '航班取消', 'flight cancel',
  // 能源/太陽能（非汽車相關）
  '太陽能', 'solar', '稅收抵免', 'tax credit', '光伏', 'photovoltaic',
  // 駕照考試（非汽車新聞）
  '駕照考試', 'driving test', '路考', 'road test', '考官',
  // 一般能源（非汽車）
  'IEA', '國際能源署', '再生能源', 'renewable energy',
  // 電池儲存（非汽車）
  'Powerwall', '家用電池', 'home battery',
  // 航空
  '機場', 'airport', '航空業', 'aviation', '飛機', 'aircraft',
]

// 品牌別名映射（用於標準化）
const BRAND_ALIASES: Record<string, string> = {
  'VW': 'Volkswagen',
  'Xiaopeng': 'XPeng',
  'Benz': 'Mercedes-Benz',
  'Mercedes': 'Mercedes-Benz',  // 🔧 修復: 統一 Mercedes → Mercedes-Benz
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
 * 檢測是否為機車相關內容
 */
export function isMotorcycleContent(title: string, content: string): boolean {
  const text = (title + ' ' + content.slice(0, 500)).toLowerCase()

  // 檢查專門的摩托車品牌（出現即判定為摩托車）
  for (const brand of PURE_MOTORCYCLE_BRANDS) {
    if (text.includes(brand.toLowerCase())) {
      return true
    }
  }

  // 檢查機車關鍵詞
  let keywordMatches = 0
  for (const keyword of MOTORCYCLE_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      keywordMatches++
    }
  }

  // 對於雙重品牌（BMW/Honda/Suzuki），只有同時出現摩托車關鍵詞時才判定
  let hasDualBrand = false
  for (const brand of DUAL_BRANDS) {
    if (text.includes(brand.toLowerCase())) {
      hasDualBrand = true
      break
    }
  }

  // 雙重品牌：需要至少 1 個摩托車關鍵詞
  if (hasDualBrand && keywordMatches >= 1) {
    return true
  }

  // 非品牌文章：需要 2 個以上摩托車關鍵詞
  if (!hasDualBrand && keywordMatches >= 2) {
    return true
  }

  return false
}

/**
 * 檢測是否為不相關內容（非汽車新聞）
 */
export function isIrrelevantContent(title: string, content: string): boolean {
  const text = (title + ' ' + content.slice(0, 500)).toLowerCase()

  // 檢查不相關關鍵詞
  for (const keyword of IRRELEVANT_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return true
    }
  }

  return false
}

/**
 * 過濾機車相關文章
 */
export function filterOutMotorcycleArticles<T extends { title: string; content: string }>(
  articles: T[]
): T[] {
  return articles.filter(article => {
    const isMotorcycle = isMotorcycleContent(article.title, article.content)
    if (isMotorcycle) {
      console.log(`🏍️  Filtered out motorcycle article: ${article.title.slice(0, 100)}`)
    }
    return !isMotorcycle
  })
}

/**
 * 過濾汽車相關文章（排除機車和不相關內容）
 */
export function filterCarArticles<T extends { title: string; content: string }>(
  articles: T[]
): T[] {
  return articles.filter(article => {
    // 暫時停用機車過濾器 - 太多誤判，寧可讓少數機車文章通過，也不要過濾掉汽車文章
    // if (isMotorcycleContent(article.title, article.content)) {
    //   console.log(`🏍️  Filtered: motorcycle - ${article.title.slice(0, 100)}`)
    //   return false
    // }

    // 檢查不相關內容
    if (isIrrelevantContent(article.title, article.content)) {
      console.log(`🚫 Filtered: irrelevant - ${article.title.slice(0, 100)}`)
      return false
    }

    return true
  })
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
