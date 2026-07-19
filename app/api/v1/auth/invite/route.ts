import { NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"

const ALLOWED_ROLES = ["admin", "member", "viewer"]

// POST /api/v1/auth/invite
// The prior version of this route was a 2-line GET-only stub (every POST
// 405'd), and even the working version before that never sent a real
// email -- it only wrote a row to an "invitations" table that had no
// migration and nothing ever read, while still telling the admin
// "Invitation sent". This uses Supabase's own admin.inviteUserByEmail,
// which actually creates the user and sends a real email, tagged with
// this org/role so app/auth/callback/route.ts's ensureUserProfile joins
// them to the inviter's organization instead of creating a new one.
async function inviteHandler(req: NextRequest, context: AuthContext & { params: Record<string, string> }) {
  if (context.role !== "owner" && context.role !== "admin") {
    return NextResponse.json({ error: "Only owners and admins can invite team members" }, { status: 403 })
  }

  const { email, role } = await req.json()
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const normalizedRole = ALLOWED_ROLES.includes(role) ? role : "member"
  const normalizedEmail = String(email).trim().toLowerCase()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!siteUrl) {
    console.error("[auth] Missing canonical site URL for invite")
    return NextResponse.json({ error: "Invites are temporarily unavailable" }, { status: 503 })
  }

  const redirectTo = new URL("/auth/callback", siteUrl)
  redirectTo.searchParams.set("next", "/auth/reset-password")

  const db = createServiceClient()
  const { error } = await db.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: redirectTo.toString(),
    data: {
      invited_organization_id: context.organizationId,
      invited_role: normalizedRole,
      invited_by: context.email,
    },
  })

  if (error) {
    console.error("[auth] inviteUserByEmail failed:", error.message)
    const message = error.message.toLowerCase().includes("already registered")
      ? "This email already has an account and can't be invited to a new organization."
      : error.message || "Failed to send invitation"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ success: true, message: "Invitation sent" })
}

export const POST = withAuth(inviteHandler)
