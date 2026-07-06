import { createClient } from "@/lib/supabase/server"
import { User } from "@/types/auth"

/**
 * Checks if a user is a platform admin.
 * Platform admins have the `platform_admin` role in the `auth.users` table.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  if (error || !data) {
    console.error("Failed to fetch user role:", error)
    return false
  }

  return data.role === "platform_admin"
}

/**
 * Lists all platform admins.
 */
export async function listPlatformAdmins(): Promise<User[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "platform_admin")

  if (error) {
    console.error("Failed to fetch platform admins:", error)
    return []
  }

  return data
}

/**
 * Grants platform admin role to a user.
 */
export async function grantPlatformAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({ role: "platform_admin" })
    .eq("id", userId)

  if (error) {
    console.error("Failed to grant platform admin role:", error)
    return false
  }

  return true
}

/**
 * Revokes platform admin role from a user.
 */
export async function revokePlatformAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({ role: "user" })
    .eq("id", userId)

  if (error) {
    console.error("Failed to revoke platform admin role:", error)
    return false
  }

  return true
}