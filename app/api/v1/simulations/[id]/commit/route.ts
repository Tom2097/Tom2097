"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { commitSimulation } from "@/lib/simulation/workspace-simulator"

export const POST = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  try {
    await commitSimulation(organizationId, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to commit simulation'
    return NextResponse.json({ error: message }, { status: 404 })
  }
})
