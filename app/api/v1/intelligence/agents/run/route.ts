import { withAuth } from "@/lib/auth/with-auth"
import { autoAssignFindings } from "@/lib/intelligence/agents"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { organizationId }) => {
  const result = await autoAssignFindings(organizationId)
  return NextResponse.json({ success: true, result })
})
