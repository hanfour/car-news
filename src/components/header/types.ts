export interface Brand {
  name: string
  logoUrl: string
}

export interface CountryBrands {
  country: string
  brands: Brand[]
}
