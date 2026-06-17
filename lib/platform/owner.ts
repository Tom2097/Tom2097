/**
 * Platform owner (founder) identification.
 *
 * The platform owner is identified by email via the PLATFORM_OWNER_EMAIL env
 * var (comma-separated list supported for co-founders). This is intentionally
 * separate from tenant-level RBAC roles ("admin"/"member"/"viewer") which only
 * grant authority WITHIN a single company. Platform-owner status grants
 * visibility into cross-tenant capacity — never tenant data.
 */

import { createClient } from "@/lib/supabase/server"

function ownerEmails(): string[] {
  return (process.env.PLATFORM_OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ownerEmails().includes(email.toLowerCase())
}

/** Returns true when the current session belongs to a configured platform owner. */
export async function isCurrentUserPlatformOwner(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return isPlatformOwnerEmail(user?.email)
  } catch {
    return false
  }
}
