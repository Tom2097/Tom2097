import { withAuth } from "@/lib/auth/with-auth"
import { getAgents } from "@/lib/intelligence/agents"
import { NextResponse } from "next/server"

export const GET = withAuth(async () => {
  const agents = await getAgents()
  return NextResponse.json({ agents })
})
