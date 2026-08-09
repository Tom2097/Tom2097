import { createServiceClient } from "@/lib/supabase/service"
import type { AssignableRole } from "./types"

/**
 * Resolve a role to a named person (spec section 4: "assign to a role,
 * resolve to a person"). Tier 0 deliberately ships a minimal fallback
 * ladder -- role -> org owner -- not the full primary -> deputy -> role
 * pool -> escalation manager -> tenant admin chain the spec describes.
 * Building the full ladder now would mean inventing deputy/pool
 * assignments this app has no real data for; the one-hop fallback is
 * enough to guarantee the spec's actual hard requirement: a HAR is never
 * left unassigned.
 *
 * Deliberately excludes suspended profiles (profiles.status ===
 * "suspended", the same flag lib/auth/server-auth.ts's getAuthenticatedUser
 * already treats as "cannot act") -- the spec's "never assigned to a
 * deactivated user" rule.
 *
 * excludeUserId enforces separation of duties (spec section 4): the user
 * who triggered the workflow step can't be auto-assigned as its own
 * approver. If excluding them empties the role, this still falls through
 * to the owner fallback below (which itself is excluded too, if they ARE
 * the owner -- see the caller in har.ts for what happens when literally no
 * one is left).
 */
export async function resolveAssignee(
  organizationId: string,
  role: AssignableRole,
  excludeUserId?: string,
): Promise<{ userId: string; resolvedRole: AssignableRole | null; hopType: "initial" | "fallback" } | null> {
  const db = createServiceClient()

  const { data: roleMatches } = await db
    .from("profiles")
    .select("id, created_at")
    .eq("organization_id", organizationId)
    .eq("role", role)
    .neq("status", "suspended")
    .order("created_at", { ascending: true })

  const eligible = (roleMatches ?? []).filter((p) => p.id !== excludeUserId)
  if (eligible.length > 0) {
    return { userId: eligible[0].id as string, resolvedRole: role, hopType: "initial" }
  }

  if (role === "owner") return null // already tried the fallback target itself

  const { data: owners } = await db
    .from("profiles")
    .select("id, created_at")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .neq("status", "suspended")
    .order("created_at", { ascending: true })

  const eligibleOwners = (owners ?? []).filter((p) => p.id !== excludeUserId)
  if (eligibleOwners.length > 0) {
    return { userId: eligibleOwners[0].id as string, resolvedRole: "owner", hopType: "fallback" }
  }

  return null
}
