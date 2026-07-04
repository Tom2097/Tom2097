import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { requireAdminRole } from "@/lib/platform/admin-roles"

export async function POST(req: NextRequest) {
  const role = await requireAdminRole("super_admin")
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase.from("profiles").select("email, organization_id").eq("id", userId).single()
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Generate a magic link for the user (time-boxed, 30 min)
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings` },
  })

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: "Failed to generate impersonation link" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.login",
    userId: undefined,
    organizationId: profile.organization_id,
    metadata: { impersonated_user_id: userId, action: "admin_impersonation" },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ url: data.properties.action_link, email: profile.email })
}
