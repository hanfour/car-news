/**
 * 車庫圖片的 R2 key 一律是 `garage/{userId}/{carId}/{timestamp}.webp`。
 *
 * `user_cars.images` / `cover_image` 是使用者可寫入的字串，不能直接信任它指向哪個 key。
 * 這個函式只在 URL 確實落在「此使用者、此車輛」自己的前綴底下時才回傳 key，其餘一律回傳 null。
 */
export function resolveGarageImageKey(
  url: unknown,
  publicBaseUrl: string,
  userId: string,
  carId: string
): string | null {
  if (typeof url !== 'string') return null

  const base = publicBaseUrl.replace(/\/+$/, '')
  if (!base || !url.startsWith(`${base}/`)) return null

  const key = url.slice(base.length + 1)
  const prefix = `garage/${userId}/${carId}/`
  if (!key.startsWith(prefix)) return null

  // 檔名只允許單層、無點號串接，排除 ../ 與子目錄
  const filename = key.slice(prefix.length)
  return /^[A-Za-z0-9_-]+\.webp$/.test(filename) ? key : null
}
