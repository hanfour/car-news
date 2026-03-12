import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'

interface AuthResult {
  supabase: ReturnType<typeof createServiceClient>
  user: User
  userId: string
}

/**
 * Extracts and verifies the Bearer token from the Authorization header,
 * then returns the authenticated user and a service Supabase client.
 *
 * Returns null if the request has no valid auth token or the token is invalid.
 */
export async function createAuthenticatedClient(request: Request): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')

  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Cookie operations may fail in API routes when headers are already sent
            // This is expected behavior and safe to ignore
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Cookie operations may fail in API routes when headers are already sent
            // This is expected behavior and safe to ignore
          }
        },
      },
    }
  )

  const { data: { user }, error: authError } = await authClient.auth.getUser(token)

  if (authError || !user) {
    return null
  }

  const supabase = createServiceClient()

  return {
    supabase,
    user,
    userId: user.id,
  }
}
