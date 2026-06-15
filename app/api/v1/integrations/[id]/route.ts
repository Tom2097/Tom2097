import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteIntegration, getIntegration, updateIntegration } from "@/lib/integrations/engine"
import type { IntegrationUpdateInput } from "@/lib/integrations/types"

/** Extract the integration id from /api/v1/integrations/:id[/...]. */
function integrationIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("integrations")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET /api/v1/integrations/:id — fetch one. Requires integrations:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = integrationIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const integration = await getIntegration(organizationId, id)
      if (!integration) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ integration })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch integration"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:read"] },
)

/** PATCH /api/v1/integrations/:id — edit config. Requires integrations:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = integrationIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    let body: IntegrationUpdateInput
    try {
      body = (await req.json()) as IntegrationUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
      const updated = await updateIntegration(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "integration.updated",
        userId,
        organizationId,
        resourceType: "integration",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ integration: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update integration"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:write"] },
)

/** DELETE /api/v1/integrations/:id — remove. Requires integrations:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = integrationIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteIntegration(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "integration.deleted",
        userId,
        organizationId,
        resourceType: "integration",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete integration"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
