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
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
