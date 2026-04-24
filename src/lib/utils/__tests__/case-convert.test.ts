import { snakeToCamel, camelToSnake, keysToCamel, keysToSnake } from '../case-convert'

describe('snakeToCamel', () => {
  it('轉換單一底線', () => {
    expect(snakeToCamel('created_at')).toBe('createdAt')
  })

  it('轉換多個底線', () => {
    expect(snakeToCamel('is_favorites_public')).toBe('isFavoritesPublic')
  })

  it('已是 camelCase 的保持不變', () => {
    expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel')
  })

  it('處理數字', () => {
    expect(snakeToCamel('h2_title')).toBe('h2Title')
    expect(snakeToCamel('foo_1_bar')).toBe('foo1Bar')
  })

  it('空字串', () => {
    expect(snakeToCamel('')).toBe('')
  })
})

describe('camelToSnake', () => {
  it('轉換單一大寫', () => {
    expect(camelToSnake('createdAt')).toBe('created_at')
  })

  it('轉換連續大寫（目前策略：每個大寫前都加底線）', () => {
    // 注意：URL / ID 這種縮寫會被拆開，若有需要可改為保留連續大寫
    expect(camelToSnake('avatarURL')).toBe('avatar_u_r_l')
  })

  it('已是 snake_case 的保持不變', () => {
    expect(camelToSnake('created_at')).toBe('created_at')
  })
})

describe('keysToCamel', () => {
  it('轉換扁平物件', () => {
    expect(keysToCamel({ user_id: 1, created_at: 'x' })).toEqual({ userId: 1, createdAt: 'x' })
  })

  it('遞迴轉換 nested 物件', () => {
    const input = { user_id: 1, profile_info: { display_name: 'A', avatar_url: 'b' } }
    expect(keysToCamel(input)).toEqual({
      userId: 1,
      profileInfo: { displayName: 'A', avatarUrl: 'b' },
    })
  })

  it('遞迴轉換 array of objects', () => {
    const input = [{ user_id: 1 }, { user_id: 2 }]
    expect(keysToCamel(input)).toEqual([{ userId: 1 }, { userId: 2 }])
  })

  it('保留 Date 物件不變', () => {
    const d = new Date('2026-01-01')
    const res = keysToCamel({ created_at: d })
    expect(res).toEqual({ createdAt: d })
    expect((res as { createdAt: Date }).createdAt).toBe(d)
  })

  it('null / undefined / primitive 直接返回', () => {
    expect(keysToCamel(null)).toBe(null)
    expect(keysToCamel(undefined)).toBe(undefined)
    expect(keysToCamel(42)).toBe(42)
    expect(keysToCamel('str')).toBe('str')
  })

  it('不 mutate 輸入', () => {
    const input = { user_id: 1, nested: { inner_key: 'v' } }
    const snapshot = JSON.stringify(input)
    keysToCamel(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('keysToSnake', () => {
  it('轉換扁平物件', () => {
    expect(keysToSnake({ userId: 1, createdAt: 'x' })).toEqual({ user_id: 1, created_at: 'x' })
  })

  it('遞迴轉換 nested + array', () => {
    const input = { userId: 1, tags: [{ tagName: 'a' }] }
    expect(keysToSnake(input)).toEqual({ user_id: 1, tags: [{ tag_name: 'a' }] })
  })
})

describe('round-trip', () => {
  it('snake → camel → snake 等於原始（無縮寫干擾的情況）', () => {
    const original = { user_id: 1, nested: { created_at: 'x' } }
    expect(keysToSnake(keysToCamel(original))).toEqual(original)
  })
})
