import { redirect } from "next/navigation"

export default function AdminPlatformAuditRedirect() {
  redirect("/admin/security")
}
