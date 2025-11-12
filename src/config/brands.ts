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
      { name: 'Tesla', logoUrl: 'https://www.google.com/s2/favicons?domain=tesla.com&sz=128' },
      { name: 'Ford', logoUrl: 'https://www.google.com/s2/favicons?domain=ford.com&sz=128' },
      { name: 'Chevrolet', logoUrl: 'https://www.google.com/s2/favicons?domain=chevrolet.com&sz=128' },
      { name: 'Rivian', logoUrl: 'https://www.google.com/s2/favicons?domain=rivian.com&sz=128' },
      { name: 'Lucid', logoUrl: 'https://www.google.com/s2/favicons?domain=lucidmotors.com&sz=128' },
    ]
  },
  {
    country: '中國',
    brands: [
      { name: 'BYD', logoUrl: 'https://www.google.com/s2/favicons?domain=byd.com&sz=128' },
      { name: 'NIO', logoUrl: 'https://www.google.com/s2/favicons?domain=nio.com&sz=128' },
      { name: 'XPeng', logoUrl: 'https://www.google.com/s2/favicons?domain=xiaopeng.com&sz=128' },
    ]
  },
  {
    country: '德國',
    brands: [
      { name: 'BMW', logoUrl: 'https://www.google.com/s2/favicons?domain=bmw.com&sz=128' },
      { name: 'Mercedes', logoUrl: 'https://www.google.com/s2/favicons?domain=mercedes-benz.com&sz=128' },
      { name: 'Audi', logoUrl: 'https://www.google.com/s2/favicons?domain=audi.com&sz=128' },
      { name: 'Volkswagen', logoUrl: 'https://www.google.com/s2/favicons?domain=volkswagen.com&sz=128' },
      { name: 'Porsche', logoUrl: 'https://www.google.com/s2/favicons?domain=porsche.com&sz=128' },
    ]
  },
  {
    country: '日本',
    brands: [
      { name: 'Toyota', logoUrl: 'https://www.google.com/s2/favicons?domain=toyota.com&sz=128' },
      { name: 'Honda', logoUrl: 'https://www.google.com/s2/favicons?domain=honda.com&sz=128' },
      { name: 'Lexus', logoUrl: 'https://www.google.com/s2/favicons?domain=lexus.com&sz=128' },
      { name: 'Mazda', logoUrl: 'https://www.google.com/s2/favicons?domain=mazda.com&sz=128' },
      { name: 'Subaru', logoUrl: 'https://www.google.com/s2/favicons?domain=subaru.com&sz=128' },
    ]
  },
  {
    country: '韓國',
    brands: [
      { name: 'Hyundai', logoUrl: 'https://www.google.com/s2/favicons?domain=hyundai.com&sz=128' },
      { name: 'Kia', logoUrl: 'https://www.google.com/s2/favicons?domain=kia.com&sz=128' },
      { name: 'Genesis', logoUrl: 'https://www.google.com/s2/favicons?domain=genesis.com&sz=128' },
    ]
  },
  {
    country: '義大利',
    brands: [
      { name: 'Ferrari', logoUrl: 'https://www.google.com/s2/favicons?domain=ferrari.com&sz=128' },
      { name: 'Lamborghini', logoUrl: 'https://www.google.com/s2/favicons?domain=lamborghini.com&sz=128' },
    ]
  },
  {
    country: '瑞典',
    brands: [
      { name: 'Volvo', logoUrl: 'https://www.google.com/s2/favicons?domain=volvocars.com&sz=128' },
      { name: 'Polestar', logoUrl: 'https://www.google.com/s2/favicons?domain=polestar.com&sz=128' },
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
