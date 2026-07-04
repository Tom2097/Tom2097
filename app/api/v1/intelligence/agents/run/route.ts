import { withAuth } from "@/lib/auth/with-auth"
import { autoAssignFindings } from "@/lib/intelligence/agents"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { organizationId }) => {
  const { agentId } = await req.json()
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 })
  const result = await autoAssignFindings(organizationId, agentId)
  return NextResponse.json({ success: true, result })
})
