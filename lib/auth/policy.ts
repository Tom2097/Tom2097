import { getUserPermissions } from "./rbac"

/**
 * Module #3: Policy Engine (permission-key based)
 *
 * Evaluates access decisions by resolving a resource:action request to a
 * permission key and checking it against the user's effective permissions
 * (direct role assignments + team-inherited roles, resolved in the DB).
 *
 * This is intentionally permission-key based (no attribute conditions) per
 * the approved Module #3 scope.
 */

export type PolicyAction = "read" | "write" | "delete" | "assign"

export interface PolicyDecision {
  allowed: boolean
  permissionKey: string
  reason: string
}

/** Build a canonical permission key from a resource and action. */
export function toPermissionKey(resource: string, action: string): string {
  return `${resource}:${action}`
}

/**
 * Evaluate a single resource:action request for a user.
 * Returns a structured decision so callers can log/audit the reason.
 */
export async function evaluatePolicy(
  userId: string,
  resource: string,
  action: PolicyAction,
): Promise<PolicyDecision> {
  const permissionKey = toPermissionKey(resource, action)
  const permissions = await getUserPermissions(userId)

  const allowed = permissions.includes(permissionKey)
  return {
    allowed,
    permissionKey,
    reason: allowed
      ? `User has '${permissionKey}'`
      : `User is missing '${permissionKey}'`,
  }
}

/**
 * Evaluate multiple resource:action requests at once.
 * `mode` controls whether ALL or ANY of the requests must pass.
 */
export async function evaluatePolicies(
  userId: string,
  requests: Array<{ resource: string; action: PolicyAction }>,
  mode: "all" | "any" = "all",
): Promise<{ allowed: boolean; decisions: PolicyDecision[] }> {
  const permissions = await getUserPermissions(userId)
  const decisions: PolicyDecision[] = requests.map(({ resource, action }) => {
    const permissionKey = toPermissionKey(resource, action)
    const allowed = permissions.includes(permissionKey)
    return {
      allowed,
      permissionKey,
      reason: allowed ? `User has '${permissionKey}'` : `User is missing '${permissionKey}'`,
    }
  })

  const allowed =
    mode === "all"
      ? decisions.every((d) => d.allowed)
      : decisions.some((d) => d.allowed)

  return { allowed, decisions }
}
