export const TIMEOUT_CONFIG = {
  MAX_DURATION_MS: 270_000, // 270秒 (4.5分鐘) - 留30秒緩衝
  MAX_ARTICLES_PER_RUN: 20, // 每次最多處理 20 篇
  MIN_ARTICLES_PER_BRAND: 1,
  TARGET_ARTICLES: 15, // 目標每次生成 15 篇
  TIME_CHECK_INTERVAL: 1000,
  ESTIMATED_TIME_PER_ARTICLE: 35_000, // img2img + Gemini Vision 需要更多時間
  MIN_TIME_BUFFER: 45_000, // 最小時間緩衝 45 秒
} as const

export const PRIORITY_BRANDS = [
  'Tesla',
  'BYD',
  'Mercedes-Benz',
  'BMW',
  'Audi',
  'Volkswagen',
  'Toyota',
  'Honda',
  'Hyundai',
  'Kia',
  'Ford',
  'Chevrolet',
  'Porsche',
  'Ferrari',
  'Lamborghini',
  'NIO',
  'XPeng',
  'Li Auto',
]

export const MAX_ARTICLES_PER_BRAND = 3
