import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { userId, organizationId }) => {
  const { email: targetEmail, role } = await req.json()

  if (!targetEmail || typeof targetEmail !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single()

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", targetEmail)
    .maybeSingle()

  if (existingProfile) {
    const { data: alreadyMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", existingProfile.id)
      .maybeSingle()

    if (alreadyMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 })
    }

    await supabase.from("organization_members").insert({
      organization_id: organizationId,
      user_id: existingProfile.id,
      role: role || "member",
      invited_by: userId,
    })
  }

  const { error } = await supabase.from("invitations").insert({
    organization_id: organizationId,
    email: targetEmail,
    role: role || "member",
    invited_by: userId,
    status: "pending",
  })

  if (error) {
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.invitation_sent",
    userId,
    organizationId: organizationId ?? undefined,
    metadata: { targetEmail, role: role || "member" },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true, message: `Invitation sent to ${targetEmail}` })
})
