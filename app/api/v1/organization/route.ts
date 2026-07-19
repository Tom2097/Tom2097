import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { NextResponse } from "next/server"

export const PUT = withAuth(async (req, { organizationId, userId, role }) => {
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { name, slug } = await req.json()

  if (!name && !slug) {
    return NextResponse.json({ error: "Name or slug required" }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (name) updates.name = name
  if (slug) updates.slug = slug

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", organizationId)

  if (error) {
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.organization_updated",
    userId,
    organizationId: organizationId ?? undefined,
    metadata: updates,
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true, ...updates })
})
