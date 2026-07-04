import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { userId, organizationId }) => {
  const { confirmation } = await req.json()

  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)

  const isLastOwner = members && members.length <= 1

  await logAuthEvent({
    action: "auth.account_deleted",
    userId,
    organizationId: organizationId ?? undefined,
    metadata: { wasLastOwner: !!isLastOwner },
    ipAddress: getClientIp(req.headers),
  })

  if (isLastOwner) {
    await supabase.from("organizations").delete().eq("id", organizationId)
  } else {
    await supabase.from("organization_members").delete().eq("user_id", userId)
  }

  await supabase.from("profiles").delete().eq("id", userId)
  await supabase.auth.admin.deleteUser(userId)

  return NextResponse.json({ success: true })
})
