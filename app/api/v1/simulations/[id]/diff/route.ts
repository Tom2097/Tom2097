"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { compareSimulation } from "@/lib/simulation/workspace-simulator"

// GET /api/v1/simulations/[id]/diff
export const GET = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  try {
    const diff = await compareSimulation(organizationId, params.id)
    return NextResponse.json({ diff })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compare simulation"
    return NextResponse.json({ error: message }, { status: 404 })
  }
})
