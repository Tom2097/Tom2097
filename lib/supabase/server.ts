import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Mock client for when Supabase is not configured
    function createMockQueryBuilder() {
      const builder: any = {
        select: (columns: string = "*") => builder,
        from: (table: string) => builder,
        eq: (column: string, value: any) => builder,
        neq: (column: string, value: any) => builder,
        or: (condition: string) => builder,
        and: (condition: string) => builder,
        order: (column: string, options: any) => builder,
        limit: (num: number) => builder,
        offset: (num: number) => builder,
        range: (start: number, end: number) => builder,
        single: async () => ({ data: null, error: { message: "Supabase not configured" } }),
        maybeSingle: async () => ({ data: null, error: { message: "Supabase not configured" } }),
      }
      
      builder.then = async (onFulfill: any, onReject?: any) => {
        const result = { data: [], error: { message: "Supabase not configured" } }
        return onFulfill ? onFulfill(result) : result
      }
      
      return builder
    }
    
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: { message: "Supabase not configured" } }),
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: "Supabase not configured" } }),
        signOut: async () => ({ error: { message: "Supabase not configured" } }),
      },
      rpc: async (fn: string, params: any = {}) => ({ data: null, error: { message: "Supabase not configured" } }),
      from: (table: string) => createMockQueryBuilder().from(table),
      select: (columns: string = "*") => createMockQueryBuilder().select(columns),
    } as any
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
