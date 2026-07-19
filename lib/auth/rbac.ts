import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * RBAC library (Module #2, extended in Module #3).
 * Dynamic, tenant-scoped roles and permissions backed by the
 * roles / permissions / role_permissions / user_roles tables.
 */

export interface Permission {
  id: string
  key: string
  resource: string
  action: string
  description: string | null
}

export interface Role {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

/**
 * Return all permission keys granted to a user across their roles.
 * Uses the get_user_permissions SQL helper (SECURITY DEFINER).
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_user_permissions", {
    p_user_id: userId,
  })

  if (error) {
    console.log("[v0] getUserPermissions error:", error.message)
    return []
  }

  return (data ?? []).map((row: { permission_key: string }) => row.permission_key)
}

/**
 * Check whether a user has a specific permission key.
 * Uses the user_has_permission SQL helper (SECURITY DEFINER).
 */
export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("user_has_permission", {
    p_user_id: userId,
    p_permission_key: permissionKey,
  })

  if (error) {
    console.log("[v0] hasPermission error:", error.message)
    return false
  }

  return data === true
}

/**
 * Check whether a user has ALL of the supplied permission keys.
 */
export async function hasAllPermissions(userId: string, keys: string[]): Promise<boolean> {
  const granted = await getUserPermissions(userId)
  const set = new Set(granted)
  return keys.every((k) => set.has(k))
}

/**
 * Check whether a user has ANY of the supplied permission keys.
 */
export async function hasAnyPermission(userId: string, keys: string[]): Promise<boolean> {
  const granted = await getUserPermissions(userId)
  const set = new Set(granted)
  return keys.some((k) => set.has(k))
}

/**
 * List all roles for an organization. RLS restricts visibility to the
 * caller's own organization.
 */
export async function listRoles(organizationId: string): Promise<Role[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })

  if (error) {
    console.log("[v0] listRoles error:", error.message)
    return []
  }

  return data ?? []
}

/**
 * List the global permission catalog.
 */
export async function listPermissions(): Promise<Permission[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("permissions").select("*").order("resource")

  if (error) {
    console.log("[v0] listPermissions error:", error.message)
    return []
  }

  return data ?? []
}

/**
 * Ensure default system roles (admin/member/viewer) exist for an org.
 * Delegates to the seed_default_roles SQL function.
 */
export async function ensureDefaultRoles(organizationId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("seed_default_roles", {
    p_org_id: organizationId,
  })

  if (error) {
    console.log("[v0] ensureDefaultRoles error:", error.message)
  }
}

/* ───────────────────────────── Module #3 ───────────────────────────── */

export interface RoleWithPermissions extends Role {
  permissions: string[]
}

/** Fetch a single role (org-scoped) with its permission keys. */
export async function getRole(organizationId: string, roleId: string): Promise<RoleWithPermissions | null> {
  const db = createServiceClient()
  const { data: role, error } = await db
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .single()

  if (error || !role) {
    console.log("[v0] getRole error:", error?.message)
    return null
  }

  const { data: perms } = await db
    .from("role_permissions")
    .select("permissions(key)")
    .eq("role_id", roleId)

  const permissions = ((perms ?? []) as Array<{ permissions: { key: string } | { key: string }[] | null }>)
    .flatMap((r) => {
      const p = r.permissions
      if (!p) return []
      return Array.isArray(p) ? p.map((x) => x.key) : [p.key]
    })
  return { ...role, permissions }
}

/** Create a custom role in an organization. */
export async function createRole(
  organizationId: string,
  name: string,
  description: string | null,
): Promise<Role | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("roles")
    .insert({ organization_id: organizationId, name, description, is_system: false })
    .select()
    .single()

  if (error) {
    console.log("[v0] createRole error:", error.message)
    return null
  }
  return data
}

/** Update a role's name/description. System roles cannot be renamed. */
export async function updateRole(
  organizationId: string,
  roleId: string,
  updates: { name?: string; description?: string | null },
): Promise<Role | null> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .single()

  if (existing?.is_system && updates.name) {
    // Prevent renaming system roles; allow description-only updates.
    delete updates.name
  }

  const { data, error } = await db
    .from("roles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .select()
    .single()

  if (error) {
    console.log("[v0] updateRole error:", error.message)
    return null
  }
  return data
}

/** Delete a non-system role. Returns false if role is a system role or not found. */
export async function deleteRole(organizationId: string, roleId: string): Promise<boolean> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .single()

  if (!existing || existing.is_system) {
    return false
  }

  const { error } = await db.from("roles").delete().eq("id", roleId).eq("organization_id", organizationId)
  if (error) {
    console.log("[v0] deleteRole error:", error.message)
    return false
  }
  return true
}

/** Add a permission to a role by permission key (org-scoped). */
export async function addPermissionToRole(
  organizationId: string,
  roleId: string,
  permissionKey: string,
): Promise<boolean> {
  const db = createServiceClient()

  // Verify role belongs to org
  const { data: role } = await db
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .single()
  if (!role) return false

  const { data: perm } = await db.from("permissions").select("id").eq("key", permissionKey).single()
  if (!perm) return false

  const { error } = await db
    .from("role_permissions")
    .upsert({ role_id: roleId, permission_id: perm.id }, { onConflict: "role_id,permission_id" })

  if (error) {
    console.log("[v0] addPermissionToRole error:", error.message)
    return false
  }
  return true
}

/* ───────────────────── ABAC Conditions (Module #3) ───────────────────── */

export type AbacConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains" | "starts_with" | "ends_with"

export interface AbacCondition {
  field: string
  operator: AbacConditionOperator
  value: unknown
}

export interface AbacRule {
  id: string
  permission_key: string
  conditions: AbacCondition[]
  effect: "allow" | "deny"
  priority: number
}

/**
 * Evaluate a set of ABAC conditions against a resource context.
 * All conditions must match for the rule to apply.
 */
export function evaluateAbacConditions(conditions: AbacCondition[], context: Record<string, unknown>): boolean {
  return conditions.every((c) => {
    const actual = getNestedValue(context, c.field)
    switch (c.operator) {
      case "eq": return actual === c.value
      case "neq": return actual !== c.value
      case "gt": return typeof actual === "number" && typeof c.value === "number" && actual > c.value
      case "gte": return typeof actual === "number" && typeof c.value === "number" && actual >= c.value
      case "lt": return typeof actual === "number" && typeof c.value === "number" && actual < c.value
      case "lte": return typeof actual === "number" && typeof c.value === "number" && actual <= c.value
      case "in": return Array.isArray(c.value) && c.value.includes(actual)
      case "not_in": return Array.isArray(c.value) && !c.value.includes(actual)
      case "contains": return typeof actual === "string" && typeof c.value === "string" && actual.includes(c.value)
      case "starts_with": return typeof actual === "string" && typeof c.value === "string" && actual.startsWith(c.value)
      case "ends_with": return typeof actual === "string" && typeof c.value === "string" && actual.endsWith(c.value)
      default: return false
    }
  })
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/**
 * Check if a user has access to a specific resource given ABAC context.
 * First verifies the user has the base permission, then evaluates ABAC rules.
 */
export async function checkAbacAccess(
  userId: string,
  permissionKey: string,
  context: Record<string, unknown>,
): Promise<boolean> {
  if (!(await hasPermission(userId, permissionKey))) return false

  const db = createServiceClient()
  const { data: rules } = await db
    .from("abac_rules")
    .select("*")
    .eq("permission_key", permissionKey)
    .order("priority", { ascending: true })

  if (!rules || rules.length === 0) return true

  for (const rule of rules as AbacRule[]) {
    const matches = evaluateAbacConditions(rule.conditions, context)
    if (matches) return rule.effect === "allow"
  }

  return true
}

/** Remove a permission from a role by permission key (org-scoped). */
export async function removePermissionFromRole(
  organizationId: string,
  roleId: string,
  permissionKey: string,
): Promise<boolean> {
  const db = createServiceClient()

  const { data: role } = await db
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("organization_id", organizationId)
    .single()
  if (!role) return false

  const { data: perm } = await db.from("permissions").select("id").eq("key", permissionKey).single()
  if (!perm) return false

  const { error } = await db
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("permission_id", perm.id)

  if (error) {
    console.log("[v0] removePermissionFromRole error:", error.message)
    return false
  }
  return true
}

/* ───────────────────── Platform Admin Helpers ───────────────────── */

/**
 * Checks if a user is a platform admin.
 *
 * Reads `profiles.role` (the canonical role source used everywhere else, e.g.
 * app/api/v1/admin/users/route.ts) rather than the `users` table, which was
 * only ever one-time-backfilled from `profiles` and is never kept in sync --
 * see the migration comment in
 * supabase/migrations/20260724000000_auth_intelligence_reachable.sql. Uses
 * the service client so this check works regardless of RLS on `profiles`.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  if (error || !data) {
    console.log("[v0] isPlatformAdmin error:", error?.message)
    return false
  }

  return data.role === "platform_admin"
}

/**
 * Checks if a user has access to a workspace.
 */
export async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("workspace_users")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)

  return !error && count !== null && count > 0
}
