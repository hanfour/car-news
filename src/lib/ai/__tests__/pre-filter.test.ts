/**
 * @jest-environment node
 */
import { preFilterContent } from '../pre-filter'

describe('preFilterContent — trivial pass', () => {
  it('passes empty string', () => {
    expect(preFilterContent('').decision).toBe('pass')
  })

  it('passes whitespace only', () => {
    expect(preFilterContent('   ').decision).toBe('pass')
  })

  it('passes 1-2 char content', () => {
    expect(preFilterContent('好').decision).toBe('pass')
    expect(preFilterContent('讚').decision).toBe('pass')
    expect(preFilterContent('OK').decision).toBe('pass')
  })
})

describe('preFilterContent — LINE solicit block', () => {
  it('blocks "加 LINE: xxx" pattern', () => {
    const r = preFilterContent('歡迎加 LINE: abc123 了解更多')
    expect(r.decision).toBe('block')
    expect(r.reason).toBe('line-solicit')
  })

  it('blocks "加賴 @abc" pattern', () => {
    expect(preFilterContent('快來加賴 @scammer123').decision).toBe('block')
  })

  it('blocks "私我 LINE id" pattern', () => {
    expect(preFilterContent('有興趣私我 line id: hot_deal_2026').decision).toBe('block')
  })

  it('does NOT block legitimate mention of LINE', () => {
    // 正常使用者談到 LINE 但沒有「加+ID」的廣告意圖 → 交給 LLM
    expect(preFilterContent('我用 LINE 跟朋友討論這台車').decision).toBe('defer')
    expect(preFilterContent('LINE 上看到的新聞').decision).toBe('defer')
  })
})

describe('preFilterContent — scam pattern block', () => {
  it('blocks 日賺萬元 variants', () => {
    expect(preFilterContent('日賺3萬不是夢').decision).toBe('block')
    expect(preFilterContent('在家日賺萬元').decision).toBe('block')
  })

  it('blocks 穩賺不賠', () => {
    expect(preFilterContent('這是穩賺不賠的好機會').decision).toBe('block')
  })

  it('blocks 加我帶單 / 加我賺錢', () => {
    expect(preFilterContent('加我帶單，包您獲利').decision).toBe('block')
    expect(preFilterContent('私我，免費報明牌').decision).toBe('block')
  })

  it('does NOT block normal car discussion mentioning prices', () => {
    expect(preFilterContent('這台車很值，CP 值高').decision).toBe('defer')
    expect(preFilterContent('Tesla 這次降價真的賺到').decision).toBe('defer')
  })
})

describe('preFilterContent — URL count block', () => {
  it('allows 1 URL (typical source link)', () => {
    expect(preFilterContent('來源：https://example.com 看看').decision).toBe('defer')
  })

  it('allows 2 URLs (article + reference)', () => {
    expect(preFilterContent('原文 https://a.com 比較 https://b.com').decision).toBe('defer')
  })

  it('blocks 3+ URLs (suspicious link spam)', () => {
    const r = preFilterContent('看看 https://a.com https://b.com https://c.com')
    expect(r.decision).toBe('block')
    expect(r.reason).toMatch(/^too-many-urls/)
  })
})

describe('preFilterContent — defers normal car content', () => {
  // 這些是正常使用者會寫的內容，**絕對不該被本地 filter 攔截**
  const realisticComments = [
    '這台 Model Y 真的開起來很順',
    'BMW 這次的設計我覺得很失敗',
    '想請問各位車友，Tesla 的保固是不是真的不太好？',
    '台灣的油價真的太高了，準備換電動車',
    '我覺得 Toyota Crown 跟 Lexus ES 比起來，內裝差很多',
  ]

  for (const comment of realisticComments) {
    it(`defers: "${comment.slice(0, 25)}..."`, () => {
      expect(preFilterContent(comment).decision).toBe('defer')
    })
  }
})
