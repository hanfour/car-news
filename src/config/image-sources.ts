/**
 * 合法图片来源白名单
 *
 * 只有来自以下域名的图片才会被下载存储：
 * 1. 官方品牌 Newsroom / Media Center
 * 2. 官方新闻发布渠道
 * 3. 已授权的图片服务
 *
 * 其他来源的图片将使用 AI 生成替代
 */

// 官方品牌 Newsroom 域名白名单
export const OFFICIAL_NEWSROOM_DOMAINS = [
  // Toyota
  'newsroom.toyota.com',
  'pressroom.toyota.com',
  'global.toyota',
  'toyota.com',

  // Tesla
  'tesla.com',
  'digitalassets.tesla.com',

  // BMW
  'press.bmw.com',
  'press.bmwgroup.com',
  'bmwgroup.com',

  // Mercedes-Benz
  'media.mercedes-benz.com',
  'media.daimler.com',
  'mercedes-benz.com',

  // Honda
  'global.honda',
  'hondanews.com',
  'honda.com',

  // Ford
  'media.ford.com',
  'ford.com',

  // Hyundai
  'hyundai.news',
  'hyundainews.com',
  'hyundai.com',

  // Kia
  'press.kia.com',
  'kia.com',

  // Volkswagen
  'volkswagen-newsroom.com',
  'volkswagen.com',
  'vw.com',

  // Audi
  'audi-mediacenter.com',
  'audi.com',

  // Porsche
  'newsroom.porsche.com',
  'porsche.com',

  // Nissan
  'global.nissannews.com',
  'nissannews.com',
  'nissan-global.com',

  // Mazda
  'newsroom.mazda.com',
  'mazda.com',

  // Subaru
  'media.subaru.com',
  'subaru.com',

  // Volvo
  'media.volvocars.com',
  'volvocars.com',

  // Lexus
  'pressroom.lexus.com',
  'lexus.com',

  // BYD
  'byd.com',
  'bydit.com',

  // NIO
  'nio.com',

  // XPeng
  'xiaopeng.com',
  'xpeng.com',

  // Lucid
  'lucidmotors.com',

  // Rivian
  'rivian.com',

  // GM / Chevrolet / Cadillac / GMC / Buick
  'media.gm.com',
  'media.chevrolet.com',
  'media.cadillac.com',
  'gm.com',
  'chevrolet.com',
  'cadillac.com',

  // Stellantis (Jeep, Dodge, Ram, Chrysler, Fiat, Alfa Romeo, Maserati)
  'media.stellantis.com',
  'stellantis.com',

  // Land Rover / Jaguar
  'media.landrover.com',
  'media.jaguar.com',
  'landrover.com',
  'jaguar.com',

  // Ferrari
  'media.ferrari.com',
  'ferrari.com',

  // Lamborghini
  'media.lamborghini.com',
  'lamborghini.com',

  // McLaren
  'media.mclaren.com',
  'mclaren.com',

  // Bentley
  'media.bentleymotors.com',
  'bentleymotors.com',

  // Rolls-Royce
  'press.rolls-roycemotorcars.com',
  'rolls-roycemotorcars.com',

  // Aston Martin
  'media.astonmartin.com',
  'astonmartin.com',

  // Bugatti
  'bugatti.com',

  // Polestar
  'media.polestar.com',
  'polestar.com',

  // Genesis
  'genesis.com',
  'genesisnewsroom.com',
]

// 已授权的图片服务（通常是 CDN 或官方使用的托管服务）
export const AUTHORIZED_IMAGE_SERVICES = [
  // 官方常用的 CDN
  'cloudinary.com',
  'imgix.net',
  's3.amazonaws.com', // 很多官方 Newsroom 使用 AWS
  'cloudfront.net',   // AWS CloudFront

  // 通用汽车图片服务
  'motortrend.com',    // 官方授权图片较多
  'caranddriver.com',  // 官方授权图片较多
]

// 需要特别检查的域名（需要判断是否为官方内容）
export const CONDITIONAL_DOMAINS = [
  // 这些域名可能包含官方图片，但需要额外验证
  'imgur.com',
  'flickr.com',
]

/**
 * 检查图片 URL 是否来自合法来源
 */
export function isLegalImageSource(imageUrl: string): {
  isLegal: boolean
  source: 'official' | 'authorized' | 'conditional' | 'unknown'
  domain: string
} {
  try {
    const url = new URL(imageUrl)
    const hostname = url.hostname.toLowerCase()

    // 检查官方 Newsroom
    for (const domain of OFFICIAL_NEWSROOM_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return { isLegal: true, source: 'official', domain }
      }
    }

    // 检查已授权服务
    for (const domain of AUTHORIZED_IMAGE_SERVICES) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return { isLegal: true, source: 'authorized', domain }
      }
    }

    // 检查需要条件判断的域名
    for (const domain of CONDITIONAL_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return { isLegal: false, source: 'conditional', domain }
      }
    }

    // 未知来源
    return { isLegal: false, source: 'unknown', domain: hostname }
  } catch {
    return { isLegal: false, source: 'unknown', domain: 'invalid-url' }
  }
}

/**
 * 获取图片来源的显示名称
 */
export function getImageSourceCredit(imageUrl: string): string {
  const { isLegal, source, domain } = isLegalImageSource(imageUrl)

  if (!isLegal) {
    return 'AI 生成示意图'
  }

  // 根据域名返回品牌名称
  const brandMapping: Record<string, string> = {
    'toyota': 'Toyota',
    'tesla': 'Tesla',
    'bmw': 'BMW',
    'mercedes': 'Mercedes-Benz',
    'honda': 'Honda',
    'ford': 'Ford',
    'hyundai': 'Hyundai',
    'kia': 'Kia',
    'volkswagen': 'Volkswagen',
    'audi': 'Audi',
    'porsche': 'Porsche',
    'nissan': 'Nissan',
    'mazda': 'Mazda',
    'subaru': 'Subaru',
    'volvo': 'Volvo',
    'lexus': 'Lexus',
    'byd': 'BYD',
    'nio': 'NIO',
    'xpeng': 'XPeng',
    'lucid': 'Lucid Motors',
    'rivian': 'Rivian',
    'gm': 'General Motors',
    'chevrolet': 'Chevrolet',
    'cadillac': 'Cadillac',
    'stellantis': 'Stellantis',
    'landrover': 'Land Rover',
    'jaguar': 'Jaguar',
    'ferrari': 'Ferrari',
    'lamborghini': 'Lamborghini',
    'mclaren': 'McLaren',
    'bentley': 'Bentley',
    'rolls-royce': 'Rolls-Royce',
    'astonmartin': 'Aston Martin',
    'bugatti': 'Bugatti',
    'polestar': 'Polestar',
    'genesis': 'Genesis',
  }

  for (const [key, brand] of Object.entries(brandMapping)) {
    if (domain.includes(key)) {
      return `圖片來源：${brand} 官方`
    }
  }

  return `圖片來源：${domain}`
}
