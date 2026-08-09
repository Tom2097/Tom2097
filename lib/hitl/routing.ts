import { createServiceClient } from "@/lib/supabase/service"
import type { AssignableRole } from "./types"

export interface ResolveAssigneeOptions {
  /**
   * When true and no OTHER eligible person exists, falls back to
   * excludeUserId themselves rather than returning null (hopType "self").
   * Used only by raiseHAR's initial assignment -- a solo-owner org must
   * still get a real assignee, not a permanently-unassigned HAR, and
   * actOnHAR's separate self-approval exception is what makes that safe.
   *
   * Left false (the default) for every other caller: actOnHAR's own
   * separation-of-duties check asks resolveAssignee "does anyone ELSE
   * exist" specifically to decide whether to allow the exception --
   * if this defaulted to true, that check would always find "someone"
   * (the excluded person themselves) and the exception could never fire.
   * The escalation sweep also wants strict "someone else" semantics:
   * escalating a stuck HAR back to the same person it's already stuck on
   * accomplishes nothing beyond what the self-approval exception already
   * allows at any time.
   */
  allowSelfFallback?: boolean
}

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
 * who triggered the workflow step is preferentially routed away from --
 * see ResolveAssigneeOptions.allowSelfFallback for what happens when
 * excluding them leaves no one.
 */
export async function resolveAssignee(
  organizationId: string,
  role: AssignableRole,
  excludeUserId?: string,
  opts: ResolveAssigneeOptions = {},
): Promise<{ userId: string; resolvedRole: AssignableRole | null; hopType: "initial" | "fallback" | "self" } | null> {
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

  if (role !== "owner") {
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
  }

  if (opts.allowSelfFallback && excludeUserId) {
    const { data: selfMatch } = await db
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", excludeUserId)
      .neq("status", "suspended")
      .maybeSingle()
    if (selfMatch) {
      return { userId: excludeUserId, resolvedRole: role, hopType: "self" }
    }
  }

  return null
}
