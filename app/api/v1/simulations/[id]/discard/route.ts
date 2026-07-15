"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { discardSimulation } from "@/lib/simulation/workspace-simulator"

export const POST = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  try {
    await discardSimulation(organizationId, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to discard simulation'
    return NextResponse.json({ error: message }, { status: 404 })
  }
})
