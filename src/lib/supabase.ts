import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instances - 在 serverless 環境中重用連線
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null
let serverAnonClient: SupabaseClient | null = null

// 共用的 global fetch 配置
const globalFetchOptions = {
  next: { revalidate: 0 },  // 不快取 API 響應
} as RequestInit

// 客户端用（浏览器）- 使用单例模式
export function createClient() {
  // 只在浏览器环境使用单例
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            storageKey: 'sb-daubcanyykdfyptntfco-auth-token',
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
