import { createServerClient, type SupabaseClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function createMockClient(): SupabaseClient {
  const builder: Record<string, unknown> = {}
  const mkChain = (): Record<string, unknown> => new Proxy(builder, {
    get: (_, prop) => {
      if (prop === "then") return async (onFulfill?: (v: unknown) => unknown) => onFulfill?.({ data: [], error: { message: "Supabase not configured" } })
      if (prop === "single" || prop === "maybeSingle") return async () => ({ data: null, error: { message: "Supabase not configured" } })
      return () => mkChain()
    },
  })
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "Supabase not configured" } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: "Supabase not configured" } }),
      signOut: async () => ({ error: { message: "Supabase not configured" } }),
    },
    rpc: async () => ({ data: null, error: { message: "Supabase not configured" } }),
    from: () => mkChain(),
  } as unknown as SupabaseClient
}

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return createMockClient()
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
