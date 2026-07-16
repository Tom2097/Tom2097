import { redirect } from "next/navigation"

export default function AdminPlatformBillingRedirect() {
  redirect("/admin/revenue")
}
