/**
 * 啟動時的環境變數健檢(warn-only)。
 *
 * 純函式,不讀 process.env 以外的狀態、不中止程序 —— 由 instrumentation.ts
 * 在 server 啟動時呼叫並把結果 log 出來。刻意不做 fail-fast(process.exit),
 * 因為多數 AI key 屬「備援/選用」,缺了只影響部分功能;硬性拒絕啟動的風險
 * 高於收益。真正缺了會全站掛的只有 Supabase 三把 key(REQUIRED)。
 */

type EnvSource = Record<string, string | undefined>

// 缺了全站級失效 —— 應該立刻在啟動 log 看到(error 級)。
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

// 缺了部分功能靜默失效 —— warn 級,不擋啟動。
const RECOMMENDED = [
  'ANTHROPIC_API_KEY',
  'FAL_KEY',
  'CRON_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'NEXT_PUBLIC_BASE_URL',
] as const

// 群組:群組內任一存在即滿足(如 Gemini 主 key 可用兩種名稱之一)。
const RECOMMENDED_ANY: readonly string[][] = [['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY']]

export interface EnvCheckResult {
  requiredMissing: string[]
  recommendedMissing: string[]
}

export function checkRequiredEnv(src: EnvSource = process.env): EnvCheckResult {
  const isSet = (key: string) => !!src[key]?.trim()

  const requiredMissing = REQUIRED.filter((key) => !isSet(key))

  const recommendedMissing = [
    ...RECOMMENDED.filter((key) => !isSet(key)),
    ...RECOMMENDED_ANY.filter((group) => !group.some(isSet)).map((group) => group.join('|')),
  ]

  return { requiredMissing, recommendedMissing }
}
