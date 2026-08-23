import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies, headers } from "next/headers"

// This file must only be imported in Server Components or Route Handlers

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

// Native mobile clients (Flutter, React Native, ...) hold their Supabase
// session as an access token in device storage and send it as
// "Authorization: Bearer <token>" -- they can't participate in the
// cookie-based session @supabase/ssr expects, since there's no browser to
// hold the cookie. This lets callers of createClient() (via
// supabase.auth.getUser(token)) validate that token directly against
// Supabase's auth server instead of only ever reading cookies. dk_-prefixed
// values are the separate internal API-key mechanism (lib/auth/api-key.ts)
// and are never a Supabase JWT, so they're excluded here.
export async function getBearerToken(): Promise<string | null> {
  const hdrs = await headers()
  const authHeader = hdrs.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice("Bearer ".length).trim()
  if (!token || token.startsWith("dk_")) return null
  return token
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
          } catch (err) {
            console.error('[supabase/server] setAll failed:', err instanceof Error ? err.message : String(err))
          }
        },
      },
    }
  )
}
