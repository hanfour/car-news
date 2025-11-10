export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符
    .replace(/\s+/g, '-')     // 空格变横杠
    .replace(/-+/g, '-')      // 多个横杠合并
    .trim()
    .slice(0, 100)            // 限制长度
}

export function extractShortId(slug: string): string | null {
  // 从URL中提取短ID：/2024/05/a7k3m9f-tesla-model-3
  const match = slug.match(/([a-zA-Z0-9]{7})-/)
  return match ? match[1] : null
}
