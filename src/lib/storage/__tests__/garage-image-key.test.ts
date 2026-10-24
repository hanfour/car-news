import { resolveGarageImageKey } from '../garage-image-key'

const BASE = 'https://cdn.example.com'
const USER = '11111111-1111-1111-1111-111111111111'
const CAR = 'c1111111-1111-1111-1111-111111111111'
const OWN = `garage/${USER}/${CAR}/1700000000000.webp`

describe('resolveGarageImageKey', () => {
  it('此使用者此車輛自己的圖片會回傳 key', () => {
    expect(resolveGarageImageKey(`${BASE}/${OWN}`, BASE, USER, CAR)).toBe(OWN)
  })

  it('公開網址尾端有斜線也能解析', () => {
    expect(resolveGarageImageKey(`${BASE}/${OWN}`, `${BASE}/`, USER, CAR)).toBe(OWN)
  })

  it.each([
    ['文章封面', `${BASE}/custom-abc1234-1700000000000.webp`],
    ['其他使用者的車庫圖', `${BASE}/garage/99999999-9999-9999-9999-999999999999/${CAR}/1.webp`],
    ['同一使用者的另一輛車', `${BASE}/garage/${USER}/c2222222-2222-2222-2222-222222222222/1.webp`],
    ['實驗圖', `${BASE}/experiments/a/b.webp`],
    ['路徑穿越', `${BASE}/garage/${USER}/${CAR}/../../x.webp`],
    ['子目錄', `${BASE}/garage/${USER}/${CAR}/sub/1.webp`],
    ['非 webp 副檔名', `${BASE}/garage/${USER}/${CAR}/1.png`],
    ['帶查詢字串', `${BASE}/${OWN}?x=1`],
    ['前綴相同但多一層', `${BASE}/garage/${USER}/${CAR}x/1.webp`],
    ['只有前綴沒有檔名', `${BASE}/garage/${USER}/${CAR}/`],
  ])('%s 不可刪除', (_label, url) => {
    expect(resolveGarageImageKey(url, BASE, USER, CAR)).toBeNull()
  })

  it('不在 R2 公開網址底下的外部連結不可刪除', () => {
    expect(resolveGarageImageKey(`https://evil.example.com/${OWN}`, BASE, USER, CAR)).toBeNull()
  })

  it('未設定公開網址時一律不刪', () => {
    expect(resolveGarageImageKey(`${BASE}/${OWN}`, '', USER, CAR)).toBeNull()
  })

  it.each([[undefined], [null], [123], [{}], [['a']]])('非字串 %p 不可刪除', (url) => {
    expect(resolveGarageImageKey(url, BASE, USER, CAR)).toBeNull()
  })
})
