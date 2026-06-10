import { createClient } from "@/lib/supabase/server"

/**
 * RBAC library (Module #2).
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
