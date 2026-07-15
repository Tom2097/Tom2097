"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createSimulation, listSimulations } from "@/lib/simulation/workspace-simulator"

// GET /api/v1/simulations?workspaceId=...
export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
  }
  const simulations = await listSimulations(organizationId, workspaceId)
  return NextResponse.json({ simulations })
})

// POST /api/v1/simulations
export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { workspaceId, changes } = await req.json()
  if (!workspaceId || !Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: "workspaceId and at least one change are required" }, { status: 400 })
  }
  const simulation = await createSimulation(organizationId, workspaceId, changes, userId)
  if (!simulation) {
    return NextResponse.json({ error: "Failed to create simulation" }, { status: 500 })
  }
  return NextResponse.json({ simulation }, { status: 201 })
})
