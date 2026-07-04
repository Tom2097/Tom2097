import { redirect } from "next/navigation"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) redirect("/")
  redirect("/platform/admin/dashboard")
}
