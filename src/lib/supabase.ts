import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instances
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

// 客户端用（浏览器）- 使用单例模式
export function createClient() {
  // 只在浏览器环境使用单例
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      console.log('[Supabase] Creating browser client instance')
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

  // 服务端环境每次创建新实例（因为可能在不同请求中）
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// 服务端用（API Routes, Cron）
export function createServiceClient() {
  // 服务端可以使用单例，因为配置不变
  if (!serviceClient) {
    console.log('[Supabase] Creating service client instance')
    serviceClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }
  return serviceClient
}
