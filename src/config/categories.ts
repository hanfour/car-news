/**
 * 文章分類配置
 * 統一管理所有分類相關資訊
 */

export interface Category {
  slug: string
  name: string
  description: string
}

export const CATEGORIES: Category[] = [
  {
    slug: '新車',
    name: '新車發表',
    description: '最新車型發表、上市資訊'
  },
  {
    slug: '評測',
    name: '試駕評測',
    description: '深度試駕、性能測試'
  },
  {
    slug: '電動車',
    name: '電動車',
    description: '電動車資訊、技術分析'
  },
  {
    slug: '產業',
    name: '產業動態',
    description: '車企經營、財報分析'
  },
  {
    slug: '市場',
    name: '市場趨勢',
    description: '銷售數據、市佔分析'
  },
  {
    slug: '科技',
    name: '科技配備',
    description: '前沿技術、創新科技'
  },
  {
    slug: '政策',
    name: '政策法規',
    description: '法規變更、補貼政策'
  },
  {
    slug: '安全',
    name: '安全召回',
    description: '安全測試、召回公告'
  },
  {
    slug: '賽車',
    name: '賽車運動',
    description: '賽事報導、車隊動態'
  }
]

// 導出常用的查詢輔助函數
export const getCategoryBySlug = (slug: string): Category | undefined => {
  return CATEGORIES.find(cat => cat.slug === slug)
}

export const isValidCategory = (slug: string): boolean => {
  return CATEGORIES.some(cat => cat.slug === slug)
}

export const VALID_CATEGORY_SLUGS = CATEGORIES.map(cat => cat.slug)
