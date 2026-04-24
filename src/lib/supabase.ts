import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instances - 在 serverless 環境中重用連線
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null
let serverAnonClient: SupabaseClient | null = null

// 從 NEXT_PUBLIC_SUPABASE_URL 動態取得 project ref
function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] || ''
}

// 共用的 global fetch 配置
const globalFetchOptions = {
  next: { revalidate: 0 },  // 不快取 API 響應
} as RequestInit

// 缺 env 時回傳的 stub：避免 build-time prerender 直接在 constructor 拋
// 「supabaseUrl is required」；實際呼叫 stub 時仍會 fail（連到 .invalid），
// 讓問題浮現而不是靜默。Preview 環境需補上 NEXT_PUBLIC_SUPABASE_* env。
const STUB_URL = 'https://missing-env.invalid'
const STUB_KEY = 'missing-env'

// 客户端用（浏览器）- 使用单例模式
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 只在浏览器环境使用单例
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createSupabaseClient(
        url || STUB_URL,
        anonKey || STUB_KEY,
        {
          auth: {
            storageKey: `sb-${getProjectRef()}-auth-token`,
            storage: window.localStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        }
      )
    }
    return browserClient
  }

  // 服務端環境也使用單例（serverless 環境中連線可跨請求重用）
  if (!serverAnonClient) {
    serverAnonClient = createSupabaseClient(
      url || STUB_URL,
      anonKey || STUB_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          fetch: (url, options) => fetch(url, { ...options, ...globalFetchOptions })
        }
      }
    )
  }
  return serverAnonClient
}

// 服务端用（API Routes, Cron）- 使用 service role key
export function createServiceClient() {
  // 服務端使用單例，連線可跨請求重用
  if (!serviceClient) {
    serviceClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || STUB_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || STUB_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          fetch: (url, options) => fetch(url, { ...options, ...globalFetchOptions })
        }
      }
    )
  }
  return serviceClient
}
