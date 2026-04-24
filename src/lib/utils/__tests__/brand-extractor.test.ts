import {
  extractBrands,
  extractPrimaryBrand,
  isMotorcycleContent,
  filterCarArticles,
} from '../brand-extractor'

describe('extractBrands', () => {
  it('找出單一英文品牌', () => {
    expect(extractBrands('Tesla Model Y 新款上市')).toContain('Tesla')
  })

  it('同時識別多個品牌', () => {
    const result = extractBrands('BMW vs Audi 性能比拼')
    expect(result).toEqual(expect.arrayContaining(['BMW', 'Audi']))
  })

  it('使用 word boundary，不會誤抓子字串', () => {
    // "Ford" 不該從 "Fordham" 被抓出
    expect(extractBrands('Fordham university news')).not.toContain('Ford')
  })

  it('中文別名對應到標準英文名', () => {
    const result = extractBrands('奔馳最新 S-Class')
    expect(result).toEqual(expect.arrayContaining(['Mercedes-Benz']))
  })

  it('case-insensitive 匹配', () => {
    expect(extractBrands('tesla is cool')).toContain('Tesla')
    expect(extractBrands('TESLA shocks market')).toContain('Tesla')
  })
})

describe('extractPrimaryBrand', () => {
  it('優先從標題取得', () => {
    expect(extractPrimaryBrand('Tesla 新車發表', 'BMW 也有新車')).toBe('Tesla')
  })

  it('標題無品牌時從內容開頭取', () => {
    expect(extractPrimaryBrand('新車評測', 'Honda Civic 全新改款...')).toBe('Honda')
  })

  it('都找不到時回傳 null', () => {
    expect(extractPrimaryBrand('科技趨勢', '未來科技...')).toBeNull()
  })
})

describe('isMotorcycleContent', () => {
  it('純機車品牌直接判定為機車', () => {
    expect(isMotorcycleContent('Harley-Davidson 發表新款', '')).toBe(true)
    expect(isMotorcycleContent('Gogoro 電動機車', '')).toBe(true)
  })

  it('雙重品牌 + 機車關鍵詞 → 機車', () => {
    expect(isMotorcycleContent('BMW 新款重機', '排氣量 1200cc')).toBe(true)
  })

  it('純汽車內容不被誤判', () => {
    expect(isMotorcycleContent('Tesla Model 3 評測', '續航里程 500 公里')).toBe(false)
  })
})

describe('filterCarArticles', () => {
  // 注意：目前 filterCarArticles 的機車過濾器已被停用（程式碼註解為「太多誤判」），
  // 僅過濾「不相關內容」。這個測試記錄目前的實際行為。
  it('過濾掉不相關內容（例如純航空類）', () => {
    const articles = [
      { title: 'Tesla 新車發表', content: '電動車續航...' },
      { title: '機場航空業新趨勢', content: '飛機科技...' },
      { title: 'Toyota 改款', content: '油電混合...' },
    ]
    const result = filterCarArticles(articles)
    expect(result.length).toBeLessThan(articles.length)
    expect(result.map((a) => a.title)).toContain('Tesla 新車發表')
  })
})
