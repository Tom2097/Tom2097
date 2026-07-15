import { redirect } from "next/navigation"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { isPlatformAdmin } from "@/lib/auth/rbac"
import { AdminShell } from "@/components/digit/admin-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user
  try {
    user = await getAuthenticatedUser()
  } catch {
    redirect("/auth/login")
  }

  const isAdmin = await isPlatformAdmin(user.id)
  if (!isAdmin) {
    redirect("/unauthorized")
  }

  return <AdminShell>{children}</AdminShell>
}
