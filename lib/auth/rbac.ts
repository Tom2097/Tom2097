import { createClient } from "../../lib/supabase/server"

/**
 * Checks if a user has a specific permission in a workspace.
 */
export async function hasPermission(
  userId: string,
  workspaceId: string,
  permission: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workspace_users")
    .select("permissions")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single()

  if (error || !data) return false
  return data.permissions.includes(permission)
}

/**
 * Checks if a user has access to a workspace.
 */
export async function hasWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("workspace_users")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)

  return !error && count !== null && count > 0
}

/**
 * Checks if a user is a platform admin.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  return !error && data?.role === "platform_admin"
}

/**
 * Checks if a user has all specified permissions.
 */
export async function hasAllPermissions(
  userId: string,
  workspaceId: string,
  permissions: string[]
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workspace_users")
    .select("permissions")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single()

  if (error || !data) return false
  return permissions.every(p => data.permissions.includes(p))
}