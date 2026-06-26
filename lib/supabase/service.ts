import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client.
 *
 * Bypasses RLS for trusted server-side writes (role/permission/team mutations).
 * MUST only be used inside API routes that have already validated the caller's
 * tenant context and permissions via withAuth. Always scope queries by
 * organization_id manually since RLS is bypassed.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    // Create a mock query builder that returns a Promise when awaited
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
      
      // Make it awaitable - when awaited, return empty results
      builder.then = async (onFulfill: any, onReject?: any) => {
        const result = { data: [], error: { message: "Supabase not configured" } }
        return onFulfill ? onFulfill(result) : result
      }
      
      return builder
    }
    
    return {
      from: (table: string) => createMockQueryBuilder().from(table),
      select: (columns: string = "*") => createMockQueryBuilder().select(columns),
      rpc: async (fn: string, params: any = {}) => ({ data: null, error: { message: "Supabase not configured" } }),
      insert: async (data: any) => ({ data: null, error: { message: "Supabase not configured" } }),
      update: async (data: any) => ({ data: null, error: { message: "Supabase not configured" } }),
      delete: async () => ({ data: null, error: { message: "Supabase not configured" } }),
      upsert: async (data: any) => ({ data: null, error: { message: "Supabase not configured" } }),
      storage: {
        from: (bucket: string) => ({
          upload: async (filePath: string, file: any) => ({ data: { path: null }, error: { message: "Supabase not configured" } }),
          download: async (filePath: string) => ({ data: null, error: { message: "Supabase not configured" } }),
          getPublicUrl: async (filePath: string) => ({ publicUrl: null }),
          list: async () => ({ data: [], error: { message: "Supabase not configured" } }),
          remove: async (paths: string[]) => ({ data: [], error: { message: "Supabase not configured" } }),
        }),
      },
    } as unknown as ReturnType<typeof createClient>
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
