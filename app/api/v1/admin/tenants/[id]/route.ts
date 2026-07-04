import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { requireAdminRole } from "@/lib/platform/admin-roles"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await requireAdminRole("super_admin")
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { action } = body

  if (!action || !["suspend", "activate", "delete"].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Use suspend, activate, or delete" }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (action === "delete") {
    const { error } = await supabase.from("organizations").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await logAuthEvent({
      action: "auth.organization_updated",
      organizationId: id,
      metadata: { admin_action: "delete_tenant" },
      ipAddress: getClientIp(req.headers),
    })
    return NextResponse.json({ success: true })
  }

  const status = action === "suspend" ? "suspended" : "active"
  const { error } = await supabase.from("organizations").update({ status }).eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.organization_updated",
    organizationId: id,
    metadata: { admin_action: `${action}_tenant` },
    ipAddress: getClientIp(req.headers),
  })

  // Also suspend/activate subscriptions
  if (action === "suspend") {
    await supabase.from("subscriptions").update({ status: "past_due" }).eq("organization_id", id).eq("status", "active")
  } else if (action === "activate") {
    await supabase.from("subscriptions").update({ status: "active" }).eq("organization_id", id).eq("status", "past_due")
  }

  return NextResponse.json({ success: true })
}
