/**
 * 汽車品牌配置
 * 統一管理所有品牌數據,避免重複定義
 */

export interface Brand {
  name: string
  logoUrl: string
}

export interface CountryBrands {
  country: string
  brands: Brand[]
}

/**
 * 按國家分組的品牌數據 (主數據源)
 */
export const BRANDS_BY_COUNTRY: CountryBrands[] = [
  {
    country: '美國',
    brands: [
      { name: 'Tesla', logoUrl: 'https://logo.clearbit.com/tesla.com' },
      { name: 'Ford', logoUrl: 'https://logo.clearbit.com/ford.com' },
      { name: 'Chevrolet', logoUrl: 'https://logo.clearbit.com/chevrolet.com' },
      { name: 'Rivian', logoUrl: 'https://logo.clearbit.com/rivian.com' },
      { name: 'Lucid', logoUrl: 'https://logo.clearbit.com/lucidmotors.com' },
    ]
  },
  {
    country: '中國',
    brands: [
      { name: 'BYD', logoUrl: 'https://logo.clearbit.com/byd.com' },
      { name: 'NIO', logoUrl: 'https://logo.clearbit.com/nio.com' },
      { name: 'XPeng', logoUrl: 'https://logo.clearbit.com/xiaopeng.com' },
    ]
  },
  {
    country: '德國',
    brands: [
      { name: 'BMW', logoUrl: 'https://logo.clearbit.com/bmw.com' },
      { name: 'Mercedes', logoUrl: 'https://logo.clearbit.com/mercedes-benz.com' },
      { name: 'Audi', logoUrl: 'https://logo.clearbit.com/audi.com' },
      { name: 'Volkswagen', logoUrl: 'https://logo.clearbit.com/vw.com' },
      { name: 'Porsche', logoUrl: 'https://logo.clearbit.com/porsche.com' },
    ]
  },
  {
    country: '日本',
    brands: [
      { name: 'Toyota', logoUrl: 'https://logo.clearbit.com/toyota.com' },
      { name: 'Honda', logoUrl: 'https://logo.clearbit.com/honda.com' },
      { name: 'Lexus', logoUrl: 'https://logo.clearbit.com/lexus.com' },
      { name: 'Mazda', logoUrl: 'https://logo.clearbit.com/mazda.com' },
      { name: 'Subaru', logoUrl: 'https://logo.clearbit.com/subaru.com' },
    ]
  },
  {
    country: '韓國',
    brands: [
      { name: 'Hyundai', logoUrl: 'https://logo.clearbit.com/hyundai.com' },
      { name: 'Kia', logoUrl: 'https://logo.clearbit.com/kia.com' },
      { name: 'Genesis', logoUrl: 'https://logo.clearbit.com/genesis.com' },
    ]
  },
  {
    country: '義大利',
    brands: [
      { name: 'Ferrari', logoUrl: 'https://logo.clearbit.com/ferrari.com' },
      { name: 'Lamborghini', logoUrl: 'https://logo.clearbit.com/lamborghini.com' },
    ]
  },
  {
    country: '瑞典',
    brands: [
      { name: 'Volvo', logoUrl: 'https://logo.clearbit.com/volvocars.com' },
      { name: 'Polestar', logoUrl: 'https://logo.clearbit.com/polestar.com' },
    ]
  },
] as const

/**
 * 扁平化的品牌列表 (從國家分組自動生成)
 * 用於 header 品牌輪播等需要所有品牌的場景
 */
export const POPULAR_BRANDS: Brand[] = BRANDS_BY_COUNTRY.flatMap(
  (countryGroup) => countryGroup.brands
)
