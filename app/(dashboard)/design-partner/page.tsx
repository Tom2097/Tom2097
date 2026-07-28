import { redirect } from "next/navigation"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { isPlatformAdmin } from "@/lib/auth/rbac"
import { DesignPartnerView } from "@/components/digit/design-partner-view"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

export default async function DesignPartnerPage() {
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

  return (
    <AnimatedGroup>
      <DesignPartnerView />
    </AnimatedGroup>
  )
}
