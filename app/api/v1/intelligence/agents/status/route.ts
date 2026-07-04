import { withAuth } from "@/lib/auth/with-auth"
import { getAgents } from "@/lib/intelligence/agents"
import { NextResponse } from "next/server"

export const GET = withAuth(async (_req, { organizationId }) => {
  const agents = await getAgents(organizationId)
  return NextResponse.json({ agents })
})
