import { withAuth } from "@/lib/auth/with-auth"
import { listConnectors, createConnector, deleteConnector, toPublicConnector } from "@/lib/connectors/engine"
import { NextResponse } from "next/server"

export const GET = withAuth(async (req, { organizationId }) => {
  const connectors = await listConnectors(organizationId)
  return NextResponse.json({ connectors: connectors.map(toPublicConnector) })
})

export const POST = withAuth(async (req, { organizationId, userId }) => {
  const { name, type, credentials, settings } = await req.json()
  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 })
  }
  const connector = await createConnector(organizationId, userId, { name, type, credentials, settings })
  if (!connector) {
    return NextResponse.json({ error: "Failed to create connector" }, { status: 500 })
  }
  return NextResponse.json({ connector: toPublicConnector(connector) }, { status: 201 })
})

export const DELETE = withAuth(async (req, { organizationId }) => {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "Connector ID required" }, { status: 400 })
  const ok = await deleteConnector(organizationId, id)
  if (!ok) return NextResponse.json({ error: "Failed to delete connector" }, { status: 500 })
  return NextResponse.json({ success: true })
})
