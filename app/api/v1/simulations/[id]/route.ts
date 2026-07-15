"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { updateSimulationStatus } from "@/lib/simulation/workspace-simulator"

// PATCH /api/v1/simulations/[id]
export const PATCH = withAuth(async (req: NextRequest, { params, organizationId }) => {
  const { id } = params
  const { status } = await req.json()
  if (!["draft", "ready", "committed", "discarded"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  const simulation = await updateSimulationStatus(organizationId, id, status)
  if (!simulation) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 })
  }
  return NextResponse.json({ simulation })
})
