import { createClient } from "@/lib/supabase/server"
import { isPlatformOwnerEmail } from "./owner"

export type AdminRole = "super_admin" | "billing_admin" | "read_only_admin"

export async function getCurrentAdminRole(): Promise<AdminRole | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return null
    if (isPlatformOwnerEmail(user.email)) return "super_admin"

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = profile?.role
    if (role === "super_admin" || role === "billing_admin" || role === "read_only_admin") {
      return role as AdminRole
    }
    return null
  } catch {
    return null
  }
}

export async function requireAdminRole(...allowed: AdminRole[]): Promise<AdminRole | null> {
  const role = await getCurrentAdminRole()
  if (!role) return null
  if (allowed.length > 0 && !allowed.includes(role)) return null
  return role
}

export function canManageBilling(role: AdminRole | null): boolean {
  return role === "super_admin" || role === "billing_admin"
}

export function isReadOnly(role: AdminRole | null): boolean {
  return role === "read_only_admin"
}
