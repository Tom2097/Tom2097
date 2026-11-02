import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { isPlatformAdmin } from "@/lib/auth/rbac"

// Materialized views are a platform-wide database tool: its API
// (/api/v1/analytics/views) is requirePlatformAdmin, but the page itself was
// reachable by any tenant, who just saw a 403 and an empty "0 views" screen.
export default async function MaterializedViewsLayout({ children }: { children: ReactNode }) {
  let user
  try {
    user = await getAuthenticatedUser()
  } catch {
    redirect("/auth/login")
  }

  if (!(await isPlatformAdmin(user.id))) {
    redirect("/unauthorized")
  }

  return <>{children}</>
}
